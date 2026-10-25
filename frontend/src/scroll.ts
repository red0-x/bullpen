import { createContext } from "react";
import { SharedValue } from "react-native-reanimated";

// Shared scroll position so cards can reveal themselves as they scroll into view.
export const ScrollYContext = createContext<SharedValue<number> | null>(null);
