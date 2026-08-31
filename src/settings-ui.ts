import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import {
	Container,
	fuzzyFilter,
	getKeybindings,
	Input,
	matchesKey,
	type SelectItem,
	Text,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import {
	cleanLayoutRows,
	moveLayoutSegment,
	reorderLayoutSegment,
	setLayoutSegmentSide,
} from "./config/layout.js";
import type { FooterRowConfig, SegmentId } from "./config/types.js";

/* Local SelectList fork that wraps a long description onto indented
   continuation lines instead of truncating it. Behaviour is otherwise
   identical to pi-tui's SelectList so existing tests keep passing. */
const DEFAULT_PRIMARY_COLUMN_WIDTH = 32;
const PRIMARY_COLUMN_GAP = 2;
const MIN_DESCRIPTION_WIDTH = 10;
const normalizeToSingleLine = (text: string) => text.replace(/[\r\n]+/g, " ").trim();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

class SelectList {
	private items: SelectItem[] = [];
	private filteredItems: SelectItem[] = [];
	private selectedIndex = 0;
	private maxVisible: number;
	private theme: {
		selectedPrefix: (text: string) => string;
		selectedText: (text: string) => string;
		description: (text: string) => string;
		scrollInfo: (text: string) => string;
		noMatch: (text: string) => string;
	};
	private layout: { minPrimaryColumnWidth?: number; maxPrimaryColumnWidth?: number };
	onSelect?: (item: SelectItem) => void;
	onCancel?: () => void;
	constructor(
		items: SelectItem[],
		maxVisible: number,
		theme: {
			selectedPrefix: (text: string) => string;
			selectedText: (text: string) => string;
			description: (text: string) => string;
			scrollInfo: (text: string) => string;
			noMatch: (text: string) => string;
		},
		layout: { minPrimaryColumnWidth?: number; maxPrimaryColumnWidth?: number } = {},
	) {
		this.items = items;
		this.filteredItems = items;
		this.maxVisible = maxVisible;
		this.theme = theme;
		this.layout = layout;
	}
	setFilter(filter: string) {
		this.filteredItems = fuzzyFilter(this.items, filter, (item) =>
			[item.value, item.label, item.description].filter(Boolean).join(" "),
		);
		this.selectedIndex = 0;
	}
	setSelectedIndex(index: number) {
		this.selectedIndex = Math.max(0, Math.min(index, this.filteredItems.length - 1));
	}
	invalidate() {}
	render(width: number): string[] {
		const lines: string[] = [];
		if (this.filteredItems.length === 0) {
			lines.push(this.theme.noMatch("  No matching settings"));
			return lines;
		}
		const primaryColumnWidth = this.getPrimaryColumnWidth();
		const startIndex = Math.max(
			0,
			Math.min(
				this.selectedIndex - Math.floor(this.maxVisible / 2),
				this.filteredItems.length - this.maxVisible,
			),
		);
		const endIndex = Math.min(startIndex + this.maxVisible, this.filteredItems.length);
		for (let i = startIndex; i < endIndex; i++) {
			const item = this.filteredItems[i];
			if (!item) continue;
			const isSelected = i === this.selectedIndex;
			const descriptionSingleLine = item.description
				? normalizeToSingleLine(item.description)
				: undefined;
			lines.push(
				...this.renderItem(item, isSelected, width, descriptionSingleLine, primaryColumnWidth),
			);
		}
		if (startIndex > 0 || endIndex < this.filteredItems.length) {
			const scrollText = `  (${this.selectedIndex + 1}/${this.filteredItems.length})`;
			lines.push(this.theme.scrollInfo(truncateToWidth(scrollText, width - 2, "")));
		}
		return lines;
	}
	handleInput(keyData: string) {
		const kb = getKeybindings();
		if (kb.matches(keyData, "tui.select.up")) {
			if (this.filteredItems.length === 0) return;
			this.selectedIndex =
				this.selectedIndex === 0 ? this.filteredItems.length - 1 : this.selectedIndex - 1;
		} else if (kb.matches(keyData, "tui.select.down")) {
			if (this.filteredItems.length === 0) return;
			this.selectedIndex =
				this.selectedIndex === this.filteredItems.length - 1 ? 0 : this.selectedIndex + 1;
		} else if (kb.matches(keyData, "tui.select.confirm")) {
			const selectedItem = this.filteredItems[this.selectedIndex];
			if (selectedItem && this.onSelect) this.onSelect(selectedItem);
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			if (this.onCancel) this.onCancel();
		}
	}
	private renderItem(
		item: SelectItem,
		isSelected: boolean,
		width: number,
		descriptionSingleLine: string | undefined,
		primaryColumnWidth: number,
	): string[] {
		const prefix = isSelected ? "\u2192 " : "  ";
		const prefixWidth = visibleWidth(prefix);
		if (descriptionSingleLine && width > 40) {
			const effectivePrimaryColumnWidth = Math.max(
				1,
				Math.min(primaryColumnWidth, width - prefixWidth - 4),
			);
			const maxPrimaryWidth = Math.max(1, effectivePrimaryColumnWidth - PRIMARY_COLUMN_GAP);
			const truncatedValue = truncateToWidth(item.label || item.value, maxPrimaryWidth, "");
			const truncatedValueWidth = visibleWidth(truncatedValue);
			const spacing = " ".repeat(Math.max(1, effectivePrimaryColumnWidth - truncatedValueWidth));
			const descriptionStart = prefixWidth + truncatedValueWidth + spacing.length;
			const remainingWidth = width - descriptionStart - 2;
			if (remainingWidth > MIN_DESCRIPTION_WIDTH) {
				if (visibleWidth(descriptionSingleLine) <= remainingWidth) {
					const truncatedDesc = truncateToWidth(descriptionSingleLine, remainingWidth, "");
					if (isSelected)
						return [
							this.theme.selectedText(`${prefix}${truncatedValue}${spacing}${truncatedDesc}`),
						];
					return [prefix + truncatedValue + this.theme.description(spacing + truncatedDesc)];
				}
				const descChunks: string[] = [];
				let remaining = descriptionSingleLine;
				let chunkWidth = remainingWidth;
				while (remaining.length > 0) {
					if (visibleWidth(remaining) <= chunkWidth) {
						descChunks.push(remaining);
						break;
					}
					let chunk = truncateToWidth(remaining, chunkWidth, "");
					const lastSep = chunk.lastIndexOf(" / ");
					if (lastSep > chunkWidth * 0.4) chunk = chunk.slice(0, lastSep);
					descChunks.push(chunk);
					remaining = remaining.slice(chunk.length).replace(/^ \/ /, "").trimStart();
					chunkWidth = width - descriptionStart - 2;
				}
				if (isSelected) {
					return [
						this.theme.selectedText(`${prefix}${truncatedValue}${spacing}${descChunks[0] ?? ""}`),
						...descChunks
							.slice(1)
							.map((chunk) => this.theme.selectedText(`${" ".repeat(descriptionStart)}${chunk}`)),
					];
				}
				return [
					prefix + truncatedValue + this.theme.description(spacing + (descChunks[0] ?? "")),
					...descChunks
						.slice(1)
						.map((chunk) => this.theme.description(`${" ".repeat(descriptionStart)}${chunk}`)),
				];
			}
		}
		const maxWidth = width - prefixWidth - 2;
		const truncatedValue = truncateToWidth(item.label || item.value, maxWidth, "");
		if (isSelected) return [this.theme.selectedText(`${prefix}${truncatedValue}`)];
		return [prefix + truncatedValue];
	}
	private getPrimaryColumnWidth(): number {
		const rawMin =
			this.layout.minPrimaryColumnWidth ??
			this.layout.maxPrimaryColumnWidth ??
			DEFAULT_PRIMARY_COLUMN_WIDTH;
		const rawMax =
			this.layout.maxPrimaryColumnWidth ??
			this.layout.minPrimaryColumnWidth ??
			DEFAULT_PRIMARY_COLUMN_WIDTH;
		const min = Math.max(1, Math.min(rawMin, rawMax));
		const max = Math.max(1, Math.max(rawMin, rawMax));
		const widestPrimary = this.filteredItems.reduce(
			(widest, item) =>
				Math.max(widest, visibleWidth(item.label || item.value) + PRIMARY_COLUMN_GAP),
			0,
		);
		return clamp(widestPrimary, min, max);
	}
	getSelectedItem(): SelectItem | null {
		const item = this.filteredItems[this.selectedIndex];
		return item || null;
	}
}

export interface SettingsUIHost {
	custom<T>(
		factory: (
			tui: { requestRender(): void },
			theme: SettingsTheme,
			keybindings: unknown,
			done: (result: T) => void,
		) => {
			render(width: number): string[];
			handleInput?(data: string): void;
			invalidate(): void;
		},
	): Promise<T>;
}

export interface SettingsTheme {
	fg(color: string, text: string): string;
	/** Optional public Theme API used to give the active tab a solid background. */
	bg?(color: string, text: string): string;
	/** Optional public Theme API used for the high-contrast active tab fallback. */
	inverse?(text: string): string;
	bold(text: string): string;
}

/** Legacy sentinel retained for compatibility with non-TUI wizard hosts. */
export const WIZARD_EXIT = "\u0000pi-x-footer:exit\u0000";

export interface SettingsSelectResult {
	value: string;
	label: string;
	description?: string;
}

export interface SettingsTab {
	title: string;
	options: readonly string[];
	/** Optional value returned immediately when Tab activates this tab. */
	activateOnTab?: string;
}

export interface SettingsSelectRequest {
	title: string;
	options: readonly string[];
	/** Optional top-level tabs. Tab/Shift+Tab switches the visible option group. */
	tabs?: readonly SettingsTab[];
	/** Initial tab index for a tabbed root menu. */
	initialTab?: number;
	/**
	 * Live preview lines (for example a rendered Footer draft) shown above the
	 * option list. Advisory only; plain text without raw ANSI.
	 * When a function is provided it will be called with the current TUI width
	 * on every render, so the preview can follow responsive fitting.
	 */
	preview?: readonly string[] | ((width: number) => readonly string[]);
	/**
	 * Left/right cycling groups: maps each option string to the ordered list of
	 * options it belongs to. Pressing ← or → on a selected cyclable row
	 * immediately confirms the previous/next value.
	 */
	cycles?: Record<string, readonly string[]>;
}

/** Split a menu option into a styled primary label and muted preview text. */
export function settingsSelectItems(options: readonly string[]): SettingsSelectResult[] {
	const parsed = options.map((value) => {
		const separators = [value.indexOf(" - "), value.indexOf(" — ")].filter((index) => index >= 0);
		const separator = separators[0];
		if (separator === undefined) return { value, label: value, description: undefined };
		return {
			value,
			label: value.slice(0, separator),
			description: value.slice(separator + 3),
		};
	});
	// Align the VALUE column: pad the `Label:` key part (not label+value) to the
	// widest key on the page, then a single space before the value. This makes
	// `Show Git:  On`, `Display:  status`, and `Label:  Git` share one column.
	const keyWidth = parsed.reduce((max, item) => {
		const colon = item.label.indexOf(":");
		return colon >= 0 ? Math.max(max, colon + 1) : max;
	}, 0);
	return parsed.map((item) => {
		const colon = item.label.indexOf(":");
		if (colon < 0) return item;
		const key = item.label.slice(0, colon + 1);
		const rest = item.label.slice(colon + 1);
		return { ...item, label: `${key.padEnd(keyWidth)} ${rest.trimStart()}` };
	});
}

export type LayoutEditorNavigation = { kind: "tab"; direction: 1 | -1 } | { kind: "exit" };

export type LayoutEditorResult = FooterRowConfig[] | LayoutEditorNavigation | undefined;

export interface LayoutEditorRequest {
	title: string;
	tabs?: readonly string[];
	activeTab?: number;
	rows: readonly FooterRowConfig[];
	labels?: Partial<Record<SegmentId, string>>;
	preview?: (
		rows: readonly FooterRowConfig[],
		width: number,
		selected?: SegmentId,
	) => readonly string[];
	onChange?: (rows: FooterRowConfig[], message: string) => Promise<boolean> | boolean;
}

interface LayoutCursor {
	id?: SegmentId;
	rowIndex: number;
}

function layoutCursorPositions(
	rows: readonly FooterRowConfig[],
): Array<LayoutCursor & { id: SegmentId }> {
	const positions: Array<LayoutCursor & { id: SegmentId }> = [];
	for (const [rowIndex, row] of rows.entries()) {
		for (const id of row.left) positions.push({ id, rowIndex });
		for (const id of row.right) positions.push({ id, rowIndex });
	}
	return positions;
}

function layoutSegmentLabel(
	id: SegmentId,
	labels: Partial<Record<SegmentId, string>> | undefined,
): string {
	return labels?.[id] ?? id;
}

/**
 * A compact two-column layout canvas. Before Enter, arrows traverse the
 * canvas; after Enter, they mutate the picked Segment's placement. This keeps
 * traversal and movement from fighting over the same key.
 */
export function editLayoutSettings(
	ui: SettingsUIHost,
	request: LayoutEditorRequest,
): Promise<LayoutEditorResult> {
	return ui.custom<LayoutEditorResult>((tui, theme, _keybindings, done) => {
		let rows: FooterRowConfig[] = cleanLayoutRows(structuredClone([...request.rows]));
		let committedRows: FooterRowConfig[] = structuredClone(rows);
		const initial = layoutCursorPositions(rows)[0];
		let cursor: LayoutCursor = {
			id: initial?.id,
			rowIndex: initial?.rowIndex ?? 0,
		};
		let pickedId: SegmentId | undefined;
		let activeId: SegmentId | undefined;
		let moving = false;
		let pendingMessage = "Layout updated";
		let closeQueued = false;
		let closed = false;
		let nextRowNumber = 1;
		let operation = Promise.resolve();

		const findSelected = (currentRows = rows) =>
			cursor.id === undefined
				? undefined
				: layoutCursorPositions(currentRows).find((position) => position.id === cursor.id);

		const findPicked = (currentRows = rows) =>
			pickedId === undefined
				? undefined
				: layoutCursorPositions(currentRows).find((position) => position.id === pickedId);

		const syncCursor = () => {
			const selected = findSelected();
			if (selected) {
				cursor.rowIndex = selected.rowIndex;
				return;
			}
			cursor.rowIndex = Math.max(0, Math.min(cursor.rowIndex, rows.length - 1));
		};

		const applyRows = (nextRows: FooterRowConfig[], message: string, nextId = cursor.id): void => {
			rows = nextRows;
			pendingMessage = message;
			cursor.id = nextId;
			syncCursor();
			tui.requestRender();
		};

		const enqueue = (task: () => Promise<void> | void) => {
			if (closeQueued) return;
			operation = operation.then(async () => {
				if (!closeQueued) await task();
			});
		};

		const finish = (result: LayoutEditorResult = structuredClone(committedRows)) => {
			if (closeQueued) return;
			closeQueued = true;
			operation.then(() => {
				if (closed) return;
				closed = true;
				done(result);
			});
		};

		const confirmPlacement = async (): Promise<void> => {
			if (!moving) {
				if (cursor.id === undefined) return;
				pickedId = cursor.id;
				activeId = cursor.id;
				moving = true;
				pendingMessage = `${layoutSegmentLabel(cursor.id, request.labels)} selected`;
				tui.requestRender();
				return;
			}
			const cleanedRows = cleanLayoutRows(rows);
			let accepted = true;
			if (request.onChange && JSON.stringify(cleanedRows) !== JSON.stringify(committedRows)) {
				try {
					accepted = await request.onChange(cleanedRows, pendingMessage);
				} catch {
					accepted = false;
				}
			}
			if (!accepted) {
				tui.requestRender();
				return;
			}
			rows = cleanedRows;
			committedRows = structuredClone(cleanedRows);
			moving = false;
			pickedId = undefined;
			activeId = undefined;
			pendingMessage = "Layout updated";
			syncCursor();
			tui.requestRender();
		};

		const cancelPlacement = () => {
			rows = structuredClone(committedRows);
			moving = false;
			cursor.id = activeId ?? layoutCursorPositions(rows)[0]?.id;
			pickedId = undefined;
			activeId = undefined;
			syncCursor();
			tui.requestRender();
		};

		const focusRelative = (direction: 1 | -1) => {
			const positions = layoutCursorPositions(rows);
			if (positions.length === 0) return;
			const currentIndex = cursor.id
				? positions.findIndex((position) => position.id === cursor.id)
				: direction > 0
					? -1
					: 0;
			const next = positions[(currentIndex + direction + positions.length) % positions.length];
			if (!next) return;
			cursor = { id: next.id, rowIndex: next.rowIndex };
			tui.requestRender();
		};

		const focusByDirection = (direction: "up" | "down" | "left" | "right") => {
			const current = findSelected();
			if (!current) {
				focusRelative(1);
				return;
			}
			const row = rows[current.rowIndex];
			if (!row) return;
			if (direction === "left" || direction === "right") {
				const side = row.left.includes(current.id) ? "left" : "right";
				const currentIndex = row[side].indexOf(current.id);
				if (side === "left") {
					if (direction === "right" && currentIndex < row.left.length - 1) {
						cursor.id = row.left[currentIndex + 1];
						tui.requestRender();
						return;
					}
					if (direction === "left" && currentIndex > 0) {
						cursor.id = row.left[currentIndex - 1];
						tui.requestRender();
						return;
					}
					if (direction === "right" && row.right.length > 0) {
						cursor.id = row.right[0];
						tui.requestRender();
						return;
					}
					focusRelative(direction === "left" ? -1 : 1);
					return;
				}
				if (direction === "left" && currentIndex > 0) {
					cursor.id = row.right[currentIndex - 1];
					tui.requestRender();
					return;
				}
				if (direction === "left" && row.left.length > 0) {
					cursor.id = row.left[row.left.length - 1];
					tui.requestRender();
					return;
				}
				if (direction === "right" && currentIndex < row.right.length - 1) {
					cursor.id = row.right[currentIndex + 1];
					tui.requestRender();
					return;
				}
				focusRelative(direction === "left" ? -1 : 1);
				return;
			}

			const side = row.left.includes(current.id) ? "left" : "right";
			const step = direction === "up" ? -1 : 1;
			for (
				let rowIndex = current.rowIndex + step;
				rowIndex >= 0 && rowIndex < rows.length;
				rowIndex += step
			) {
				const target = rows[rowIndex]?.[side];
				if (target && target.length > 0) {
					cursor.id = target[0];
					cursor.rowIndex = rowIndex;
					tui.requestRender();
					return;
				}
			}
			focusRelative(step);
		};

		const moveSelectedToRow = async (rowIndex: number): Promise<void> => {
			const selected = findPicked();
			if (!selected || rowIndex < 0 || rowIndex >= rows.length || rowIndex === selected.rowIndex)
				return;
			const source = rows[selected.rowIndex];
			const target = rows[rowIndex];
			if (!source || !target) return;
			const side = source.left.includes(selected.id) ? "left" : "right";
			await applyRows(
				moveLayoutSegment(rows, selected.id, target.id, side),
				`${layoutSegmentLabel(selected.id, request.labels)} moved to row ${rowIndex + 1}`,
			);
		};

		const reorderSelectedWithinSide = async (direction: "left" | "right"): Promise<void> => {
			const selected = findPicked();
			if (!selected) return;
			const source = rows[selected.rowIndex];
			if (!source) return;
			const side = source.left.includes(selected.id) ? "left" : "right";
			const group = source[side];
			const currentIndex = group.indexOf(selected.id);
			const targetIndex = currentIndex + (direction === "left" ? -1 : 1);
			if (currentIndex < 0 || targetIndex < 0 || targetIndex >= group.length) return;

			await applyRows(
				reorderLayoutSegment(rows, selected.id, direction),
				`${layoutSegmentLabel(selected.id, request.labels)} moved ${direction} within ${side}`,
			);
		};

		const moveSelectedToSide = async (side: "left" | "right"): Promise<void> => {
			const selected = findPicked();
			if (!selected) return;
			const source = rows[selected.rowIndex];
			const currentSide = source?.left.includes(selected.id) ? "left" : "right";
			if (currentSide === side) return;
			await applyRows(
				setLayoutSegmentSide(rows, selected.id, side),
				`${layoutSegmentLabel(selected.id, request.labels)} aligned ${side}`,
			);
		};

		const grid = {
			render(width: number): string[] {
				const gap = 3;
				const columnWidth = Math.max(4, Math.floor(Math.max(8, width - gap) / 2));
				const renderGroup = (ids: readonly SegmentId[]): string => {
					if (ids.length === 0) {
						// Padding preserves the two-column alignment without rendering an
						// orphan marker that looks like an empty row.
						return " ".repeat(columnWidth);
					}
					const raw = ids
						.map((id) => {
							const isPicked = moving && pickedId === id;
							const isFocused = !isPicked && cursor.id === id;
							const marker = isPicked ? "→ " : isFocused ? "› " : "  ";
							const label = `${marker}${layoutSegmentLabel(id, request.labels)}`;
							return isPicked
								? theme.fg("accent", theme.bold(label))
								: isFocused
									? theme.fg("dim", label)
									: theme.fg("text", label);
						})
						.join(" · ");
					const clipped = truncateToWidth(raw, columnWidth, "");
					return clipped + " ".repeat(Math.max(0, columnWidth - visibleWidth(clipped)));
				};
				return rows.map(
					(row) => `${renderGroup(row.left)}${" ".repeat(gap)}${renderGroup(row.right)}`,
				);
			},
			invalidate() {},
		};

		const preview = {
			render(width: number): string[] {
				const lines = request.preview?.(rows, width, moving ? pickedId : undefined) ?? [];
				if (lines.length === 0) return [theme.fg("dim", "Preview: (no preview)")];
				return [theme.fg("dim", "Preview:"), ...lines];
			},
			invalidate() {},
		};

		const layoutTabs = request.tabs && request.tabs.length > 0 ? request.tabs : undefined;
		const tabBar = layoutTabs
			? {
					render(width: number): string[] {
						const activeTab = Math.max(0, Math.min(request.activeTab ?? 0, layoutTabs.length - 1));
						const text = layoutTabs
							.map((tab, index) => {
								const label = ` ${tab} `;
								if (index !== activeTab) return theme.fg("text", label);
								if (theme.inverse) return theme.inverse(theme.bold(label));
								const selected = theme.fg("text", theme.bold(label));
								return theme.bg ? theme.bg("selectedBg", selected) : theme.fg("accent", selected);
							})
							.join("    ");
						return [truncateToWidth(text, width, "")];
					},
					invalidate() {},
				}
			: undefined;

		const hint = {
			render(width: number): string[] {
				const tabHint = "tab next · shift+tab previous · ";
				const text = moving
					? `${tabHint}↑↓ move row · ←→ reorder within side · n new row · x remove row · l left · r right · enter confirm · esc cancel`
					: `${tabHint}↑↓←→ traverse · enter select · esc back`;
				return [theme.fg("dim", truncateToWidth(text, width, ""))];
			},
			invalidate() {},
		};

		const container = new Container();
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		container.addChild(new Text(theme.fg("accent", theme.bold(request.title)), 1, 0));
		container.addChild(preview);
		container.addChild(new Text("", 1, 0));
		container.addChild(new DynamicBorder((text: string) => theme.fg("dim", text)));
		if (tabBar) container.addChild(tabBar);
		container.addChild(new Text("", 1, 0));
		container.addChild(grid);
		container.addChild(new Text("", 1, 0));
		container.addChild(hint);
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));

		return {
			render: (width) => container.render(width),
			handleInput: (data) => {
				if (closed) return;
				const keybindings = getKeybindings();
				enqueue(async () => {
					if (matchesKey(data, "tab")) {
						finish({ kind: "tab", direction: 1 });
						return;
					}
					if (matchesKey(data, "shift+tab")) {
						finish({ kind: "tab", direction: -1 });
						return;
					}
					if (keybindings.matches(data, "tui.select.cancel")) {
						if (moving) cancelPlacement();
						else finish({ kind: "exit" });
						return;
					}
					if (keybindings.matches(data, "tui.select.confirm")) {
						await confirmPlacement();
						return;
					}

					if (!moving) {
						if (matchesKey(data, "up")) {
							focusByDirection("up");
							return;
						}
						if (matchesKey(data, "down")) {
							focusByDirection("down");
							return;
						}
						if (matchesKey(data, "left")) {
							focusByDirection("left");
							return;
						}
						if (matchesKey(data, "right")) {
							focusByDirection("right");
							return;
						}
						return;
					}

					if (matchesKey(data, "up")) {
						await moveSelectedToRow((findPicked()?.rowIndex ?? cursor.rowIndex) - 1);
						return;
					}
					if (matchesKey(data, "down")) {
						await moveSelectedToRow((findPicked()?.rowIndex ?? cursor.rowIndex) + 1);
						return;
					}
					if (matchesKey(data, "left")) {
						await reorderSelectedWithinSide("left");
						return;
					}
					if (matchesKey(data, "right")) {
						await reorderSelectedWithinSide("right");
						return;
					}
					if (matchesKey(data, "l")) {
						await moveSelectedToSide("left");
						return;
					}
					if (matchesKey(data, "r")) {
						await moveSelectedToSide("right");
						return;
					}
					if (matchesKey(data, "n")) {
						const nextRows = structuredClone(rows);
						const rowIndex = Math.max(0, Math.min(cursor.rowIndex, nextRows.length - 1));
						let id = `row-${nextRowNumber++}`;
						while (nextRows.some((row) => row.id === id)) id = `row-${nextRowNumber++}`;
						nextRows.splice(rowIndex + 1, 0, {
							id,
							left: [],
							right: [],
							visible: "always",
							overflow: "hide",
						});
						applyRows(nextRows, `Inserted row ${rowIndex + 2}`);
						return;
					}
					if (matchesKey(data, "x")) {
						const rowIndex = Math.max(0, Math.min(cursor.rowIndex, rows.length - 1));
						const nextRows = structuredClone(rows);
						const row = nextRows[rowIndex];
						if (!row) return;
						nextRows.splice(rowIndex, 1);
						const positions = layoutCursorPositions(nextRows);
						const next =
							positions.find((position) => position.rowIndex >= rowIndex) ?? positions.at(-1);
						if (pickedId !== undefined && !findPicked(nextRows)) {
							pickedId = undefined;
						}
						applyRows(nextRows, `Removed row ${rowIndex + 1}`, next?.id);
					}
				});
			},
			invalidate: () => container.invalidate(),
		};
	});
}

const lastSelectionByTitle = new Map<string, string>();

type OptionState = "on" | "off";

function optionState(value: string): OptionState | undefined {
	if (value.includes(": On")) return "on";
	if (value.includes(": Off")) return "off";
	return undefined;
}

function styleOption(item: SelectItem, theme: SettingsTheme): SelectItem {
	if (item.value.includes("🔒")) {
		return {
			...item,
			label: theme.fg("dim", item.label),
			description: item.description ? theme.fg("dim", item.description) : undefined,
		};
	}
	const state = optionState(item.value);
	if (!state) return item;
	return {
		...item,
		label: theme.fg(state === "on" ? "success" : "dim", item.label),
	};
}

function selectedOptionColor(text: string, theme: SettingsTheme): string {
	if (text.includes("🔒") || text.includes("Off")) return theme.fg("dim", text);
	if (text.includes("On")) return theme.fg("success", text);
	return theme.fg("accent", text);
}

function restoreIndex(options: readonly string[], title: string): number {
	const previous = lastSelectionByTitle.get(title);
	if (!previous) return -1;
	const exact = options.indexOf(previous);
	if (exact >= 0) return exact;
	const colon = previous.indexOf(":");
	if (colon < 0) return -1;
	const prefix = previous.slice(0, colon + 1);
	return options.findIndex((option) => option.startsWith(prefix));
}

export function selectSettings(
	ui: SettingsUIHost,
	request: SettingsSelectRequest,
): Promise<string | undefined> {
	return ui.custom<string | undefined>((tui, theme, _keybindings, done) => {
		const tabs = request.tabs && request.tabs.length > 0 ? request.tabs : undefined;
		const tabLists = (tabs ?? [{ title: "", options: request.options }]).map((tab) => {
			const items: SelectItem[] = settingsSelectItems(tab.options).map((item) =>
				styleOption(item, theme),
			);
			const selectList = new SelectList(
				items,
				Math.min(Math.max(items.length, 1), 12),
				{
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => selectedOptionColor(text, theme),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				},
				{
					minPrimaryColumnWidth: 12,
					maxPrimaryColumnWidth: 40,
				},
			);
			const selectionTitle = tabs ? `${request.title} · ${tab.title}` : request.title;
			const restoredIndex = restoreIndex(tab.options, selectionTitle);
			if (restoredIndex >= 0) selectList.setSelectedIndex(restoredIndex);
			return { selectList, selectionTitle };
		});
		let activeTab = tabs
			? ((Math.trunc(request.initialTab ?? 0) % tabs.length) + tabs.length) % tabs.length
			: 0;
		let selectList = tabLists[activeTab]?.selectList;
		if (!selectList) {
			done(undefined);
			return {
				render: () => [],
				handleInput: () => {},
				invalidate: () => {},
			};
		}
		const tabTitle = () => tabLists[activeTab]?.selectionTitle ?? request.title;
		for (const tabList of tabLists) {
			tabList.selectList.onSelect = (item) => {
				lastSelectionByTitle.set(tabTitle(), item.value);
				done(item.value);
			};
			tabList.selectList.onCancel = () => done(undefined);
		}

		const searchInput = new Input();
		searchInput.focused = true;
		const previewComponent = {
			render(width: number): string[] {
				const raw =
					typeof request.preview === "function" ? request.preview(width) : (request.preview ?? []);
				if (raw.length === 0) return [theme.fg("dim", "Preview: (no preview)")];
				const out: string[] = [theme.fg("dim", "Preview:")];
				for (const line of raw) {
					const isHighlighted = line.includes("\u001b[1m");
					out.push(isHighlighted ? line : theme.fg("text", line));
				}
				return out;
			},
			invalidate() {},
		};
		const tabsComponent = tabs
			? {
					render(width: number): string[] {
						const text = tabs
							.map((tab, index) => {
								const label = ` ${tab.title} `;
								if (index !== activeTab) return theme.fg("text", label);
								if (theme.inverse) return theme.inverse(theme.bold(label));
								const selected = theme.fg("text", theme.bold(label));
								return theme.bg ? theme.bg("selectedBg", selected) : theme.fg("accent", selected);
							})
							.join("    ");
						return [truncateToWidth(text, width, "")];
					},
					invalidate() {},
				}
			: undefined;

		const hasSearch = () => searchInput.getValue().trim().length > 0;

		const selectListComponent = {
			render: (width: number): string[] => selectList?.render(width) ?? [],
			invalidate: () => selectList?.invalidate(),
		};
		const container = new Container();
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		container.addChild(new Text(theme.fg("accent", theme.bold(request.title)), 1, 0));
		container.addChild(previewComponent);
		// Keep the preview visually separate from the tabbed settings area.
		container.addChild(new Text("", 1, 0));
		container.addChild(new DynamicBorder((text: string) => theme.fg("dim", text)));
		if (tabsComponent) container.addChild(tabsComponent);
		// Keep the query control directly below the tab bar and above the options.
		container.addChild(searchInput);
		container.addChild(new Text("", 1, 0));
		container.addChild(selectListComponent);
		const hintComponent = {
			render(width: number): string[] {
				const tabHint = tabs ? "tab next · shift+tab previous · " : "";
				const text = hasSearch()
					? `${tabHint}↑↓ navigate · enter confirm · ←→ edit query · esc back`
					: `${tabHint}type to search · ↑↓ navigate · ←→ change & save · enter confirm · esc back`;
				return [theme.fg("dim", truncateToWidth(text, width, ""))];
			},
			invalidate() {},
		};
		container.addChild(hintComponent);
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));

		const cycleValue = (direction: 1 | -1): boolean => {
			const cycles = request.cycles;
			if (!cycles) return false;
			const selected = selectList?.getSelectedItem();
			if (!selected) return false;
			const group = cycles[selected.value];
			if (!group || group.length < 2) return false;
			const index = group.indexOf(selected.value);
			if (index < 0) return false;
			const next = group[(index + direction + group.length) % group.length];
			if (next === undefined || next === selected.value) return false;
			lastSelectionByTitle.set(tabTitle(), next);
			done(next);
			return true;
		};

		const switchTab = (direction: 1 | -1): boolean => {
			if (!tabs || tabs.length < 2) return false;
			activeTab = (activeTab + direction + tabs.length) % tabs.length;
			const tab = tabs[activeTab];
			if (tab?.activateOnTab !== undefined) {
				done(tab.activateOnTab);
				return true;
			}
			selectList = tabLists[activeTab]?.selectList;
			if (!selectList) return false;
			searchInput.setValue("");
			selectList.setFilter("");
			tui.requestRender();
			return true;
		};

		return {
			render: (width) => container.render(width),
			handleInput: (data) => {
				const keybindings = getKeybindings();
				if (tabs && matchesKey(data, "tab")) {
					switchTab(1);
					return;
				}
				if (tabs && matchesKey(data, "shift+tab")) {
					switchTab(-1);
					return;
				}
				if (keybindings.matches(data, "tui.select.cancel")) {
					selectList?.handleInput(data);
					tui.requestRender();
					return;
				}
				if (!hasSearch() && matchesKey(data, "right")) {
					if (cycleValue(1)) return;
				} else if (!hasSearch() && matchesKey(data, "left")) {
					if (cycleValue(-1)) return;
				}
				if (
					keybindings.matches(data, "tui.select.up") ||
					keybindings.matches(data, "tui.select.down") ||
					keybindings.matches(data, "tui.select.confirm")
				) {
					selectList?.handleInput(data);
				} else {
					searchInput.handleInput(data);
					selectList?.setFilter(searchInput.getValue());
				}
				tui.requestRender();
			},
			invalidate: () => container.invalidate(),
		};
	});
}
