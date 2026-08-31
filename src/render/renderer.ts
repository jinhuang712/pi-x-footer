import type { Component } from "@earendil-works/pi-tui";
import type { FooterConfig } from "../config/types.js";
import { layoutFooter, renderAlignedGroups } from "../layout/index.js";
import { resolveSegments } from "../segments/index.js";
import type { FooterStore } from "../state/store.js";
import { prepareSegmentForLayout, styleSegment } from "./presentation.js";
import { styleSeparator } from "./theme.js";
import type { ThemeLike } from "./types.js";

export interface FooterTuiLike {
	requestRender(): void;
}

export interface FooterComponentOptions {
	store: FooterStore;
	config: FooterConfig;
	theme?: ThemeLike;
	tui: FooterTuiLike;
}

export class FooterComponent implements Component {
	private readonly store: FooterStore;
	private readonly config: FooterConfig;
	private readonly theme?: ThemeLike;
	private readonly tui: FooterTuiLike;
	private readonly unsubscribe: () => void;
	private redrawRequested = false;
	private disposed = false;

	constructor(options: FooterComponentOptions) {
		this.store = options.store;
		this.config = options.config;
		this.theme = options.theme;
		this.tui = options.tui;
		this.unsubscribe = this.store.subscribe(() => {
			if (this.disposed || this.redrawRequested) return;
			this.redrawRequested = true;
			this.tui.requestRender();
		});
	}

	render(width: number): string[] {
		this.redrawRequested = false;
		if (this.disposed || !this.config.enabled || width <= 0) return [];
		const snapshot = this.store.getSnapshot();
		const references = this.config.layout.rows.flatMap((row) => [...row.left, ...row.right]);
		const segments = resolveSegments(snapshot, this.config, references).map((segment) =>
			prepareSegmentForLayout(segment, this.config.style),
		);
		const layout = layoutFooter(snapshot, this.config, segments, width);

		return layout.rows.map((row) => {
			const left = row.left.map(
				(segment) =>
					styleSegment(segment, this.config.style, this.theme, {
						addIcon: false,
						addStatusMarker: false,
					}).output,
			);
			const right = row.right.map(
				(segment) =>
					styleSegment(segment, this.config.style, this.theme, {
						addIcon: false,
						addStatusMarker: false,
					}).output,
			);
			const separator = styleSeparator(row.separator, this.config.style.colorMode, this.theme);
			return renderAlignedGroups(left, right, separator, width);
		});
	}

	invalidate(): void {
		// The component reads the immutable Snapshot on every render. Pi calls this
		// method when theme or terminal state changes, so no local cache is needed.
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.redrawRequested = false;
		this.unsubscribe();
	}
}

export function createFooterComponent(options: FooterComponentOptions): FooterComponent {
	return new FooterComponent(options);
}
