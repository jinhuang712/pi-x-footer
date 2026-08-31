import type { SeparatorStyle } from "../config/types.js";

export function separatorText(separator: SeparatorStyle): string {
	switch (separator) {
		case "none":
			return " ";
		case "dot":
			return " · ";
		case "bar":
			return " | ";
		case "slash":
			return " / ";
		case "ascii":
			return " | ";
		case "powerline":
			return " | ";
	}
}
