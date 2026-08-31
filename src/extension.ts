import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	applyBuiltInPreset,
	parseXFooterCommand,
	runFooterWizard,
	type WizardSaveResult,
	XFOOTER_HELP,
} from "./commands.js";
import { cloneConfig } from "./config/defaults.js";
import { loadConfig } from "./config/index.js";
import { saveConfig } from "./config/persistence.js";
import type { FooterConfig } from "./config/types.js";
import { createConversationDataSource } from "./data/conversation.js";
import { createRepositoryDataSource } from "./data/repository.js";
import { createSessionDataSource } from "./data/session.js";
import { FooterComponent } from "./render/index.js";
import {
	editLayoutSettings,
	type LayoutEditorRequest,
	type SettingsTab,
	selectSettings,
} from "./settings-ui.js";
import { createFooterStore } from "./state/store.js";
import { resolveRuntimeUsageAuth } from "./usage/auth.js";
import { createUsageManager } from "./usage/manager.js";
import type { UsageManager, UsageSessionContext } from "./usage/types.js";

export default function piXFooter(pi: ExtensionAPI): void {
	const store = createFooterStore();
	const sessionData = createSessionDataSource(store);
	const conversationData = createConversationDataSource(store);
	const repositoryData = createRepositoryDataSource(store, {
		exec: (command, args, options) => pi.exec(command, args, options),
	});
	let usageManager: UsageManager | undefined;
	let activeConfig: FooterConfig | undefined;
	let repositoryActive = false;

	const stopUsage = () => {
		usageManager?.sessionShutdown();
		usageManager = undefined;
	};

	const installFooter = (ctx: ExtensionContext, config: FooterConfig) => {
		if (ctx.mode !== "tui" || !config.enabled) {
			if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
			return;
		}
		ctx.ui.setFooter(
			(tui, theme) =>
				new FooterComponent({
					store,
					config,
					theme,
					tui,
				}),
		);
	};

	const applyRuntimeConfig = (ctx: ExtensionContext, config: FooterConfig) => {
		activeConfig = config;
		stopUsage();
		if (!config.enabled) {
			if (repositoryActive) {
				repositoryData.sessionShutdown();
				repositoryActive = false;
			}
			installFooter(ctx, config);
			return;
		}
		if (!repositoryActive) {
			repositoryData.sessionStart(ctx.cwd);
			repositoryActive = true;
		}
		usageManager = createUsageManager({
			store,
			providers: config.usage.enabled ? config.usage.providers : [],
			refreshSeconds: config.usage.refreshSeconds,
			exec: (command, args, options) => pi.exec(command, args, options),
		});
		usageManager.sessionStart(createUsageContext(ctx));
		installFooter(ctx, config);
	};

	const saveAndApply = async (
		ctx: ExtensionCommandContext,
		config: FooterConfig,
		message: string,
	): Promise<void> => {
		const loaded = loadConfig({ projectRoot: ctx.cwd });
		try {
			saveConfig(loaded.globalPath, config);
			if (ctx.mode === "tui") applyRuntimeConfig(ctx, config);
			else activeConfig = config;
			ctx.ui.notify(message, "info");
		} catch {
			ctx.ui.notify("无法保存 pi-x-footer 配置，原配置未改变。", "error");
		}
	};

	pi.registerCommand("xfooter", {
		description: "Configure the pi-x-footer Footer",
		handler: async (args, ctx) => {
			const action = parseXFooterCommand(args);
			const loaded = loadConfig({ projectRoot: ctx.cwd });
			const current = activeConfig ?? loaded.config;

			if (action.kind === "invalid") {
				ctx.ui.notify(`未知 /xfooter 参数：${action.argument}\n\n${XFOOTER_HELP}`, "error");
				return;
			}
			if (action.kind === "help") {
				ctx.ui.notify(XFOOTER_HELP, "info");
				return;
			}
			if (action.kind === "status") {
				const usage = store.getSnapshot().providerUsage;
				const usageText = usage ? `${usage.provider}: ${usage.state}` : "unavailable";
				ctx.ui.notify(
					[
						`enabled: ${current.enabled}`,
						`preset: ${current.preset}`,
						`provider usage: ${usageText}`,
						`global config: ${loaded.globalPath}`,
						...(loaded.projectPath ? [`project config: ${loaded.projectPath}`] : []),
					].join("\n"),
					"info",
				);
				return;
			}
			if (action.kind === "refresh") {
				const repositoryRefresh = repositoryData.refresh();
				const usageRefresh = usageManager?.refresh() ?? Promise.resolve();
				await Promise.allSettled([repositoryRefresh, usageRefresh]);
				ctx.ui.notify("已请求刷新 Git 和 Provider Usage。", "info");
				return;
			}
			if (action.kind === "wizard") {
				if (!ctx.hasUI) {
					ctx.ui.notify("当前模式没有可用的交互界面，无法打开配置向导。", "warning");
					return;
				}
				const wizardUI =
					ctx.mode === "tui"
						? {
								select: (request: {
									title: string;
									options: string[];
									tabs?: SettingsTab[];
									initialTab?: number;
									preview?: string[] | ((width: number) => string[]);
									cycles?: Record<string, string[]>;
								}) =>
									selectSettings(ctx.ui, {
										title: request.title,
										options: request.options,
										...(request.tabs ? { tabs: request.tabs } : {}),
										...(request.initialTab !== undefined ? { initialTab: request.initialTab } : {}),
										...(request.preview ? { preview: request.preview } : {}),
										...(request.cycles ? { cycles: request.cycles } : {}),
									}),
								layout: (request: LayoutEditorRequest) => editLayoutSettings(ctx.ui, request),
								previewSnapshot: () => store.getSnapshot(),
								input: (title: string, placeholder?: string) => ctx.ui.input(title, placeholder),
							}
						: {
								select: (request: { title: string; options: string[] }) =>
									ctx.ui.select(request.title, request.options),
								input: (title: string, placeholder?: string) => ctx.ui.input(title, placeholder),
							};
				// Each confirmed change is written to disk immediately; the live Footer
				// and Usage manager are only reinstalled once, when the wizard exits.
				const save = (config: FooterConfig): WizardSaveResult => {
					try {
						saveConfig(loaded.globalPath, config);
						return { ok: true };
					} catch {
						return {
							ok: false,
							message: "Unable to save settings. The previous configuration was not changed.",
						};
					}
				};
				const next = await runFooterWizard(current, wizardUI, save);
				if (ctx.mode === "tui") applyRuntimeConfig(ctx, next);
				else activeConfig = next;
				ctx.ui.notify("pi-x-footer 配置已更新。", "info");
				return;
			}

			const next = cloneConfig(current);
			if (action.kind === "toggle") next.enabled = !next.enabled;
			if (action.kind === "preset") applyBuiltInPreset(next, action.preset);
			await saveAndApply(ctx, next, "pi-x-footer 配置已更新。");
		},
	});

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		stopUsage();
		if (repositoryActive) repositoryData.sessionShutdown();
		repositoryActive = false;
		const loaded = loadConfig({ projectRoot: ctx.cwd });
		sessionData.sessionStart(ctx);
		conversationData.sessionStart(ctx);
		activeConfig = loaded.config;
		applyRuntimeConfig(ctx, loaded.config);
	});

	pi.on("model_select", (_event, ctx) => {
		sessionData.modelChanged(ctx);
		// Context limits are model-specific; stale values from the previous
		// model (e.g. a 272k window) must not linger after switching models.
		conversationData.refresh(ctx);
		usageManager?.modelChanged(createUsageContext(ctx));
	});

	pi.on("thinking_level_select", (_event, ctx) => {
		sessionData.thinkingLevelChanged(ctx);
	});

	pi.on("agent_start", (_event, ctx) => {
		sessionData.agentStarted(ctx);
	});

	pi.on("agent_end", (_event, ctx) => {
		sessionData.agentEnded(ctx);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		sessionData.sessionShutdown(ctx);
		stopUsage();
		repositoryData.sessionShutdown();
		repositoryActive = false;
		activeConfig = undefined;
		if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
	});

	pi.on("message_update", (_event, ctx) => {
		conversationData.refresh(ctx);
	});

	pi.on("turn_end", (_event, ctx) => {
		conversationData.refresh(ctx);
		usageManager?.turnEnded(createUsageContext(ctx));
	});

	pi.on("session_compact", (_event, ctx) => {
		conversationData.refresh(ctx);
	});

	pi.on("session_tree", (_event, ctx) => {
		conversationData.refresh(ctx);
	});
}

function createUsageContext(ctx: ExtensionContext): UsageSessionContext {
	return {
		provider: ctx.model?.provider,
		model: ctx.model?.id,
		baseUrl: ctx.model?.baseUrl,
		resolveAuth: (provider, signal) => resolveRuntimeUsageAuth(ctx, provider, signal),
	};
}
