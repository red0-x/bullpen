import { storage } from "@/src/utils/storage";

// The rental the host last worked on (Snap and Bench open on it). "all" = Bench's all-rentals view.
const KEY = "last_property";

export const getLastRental = () => storage.getItem(KEY, null as string | null);
export const setLastRental = (id: string) => storage.setItem(KEY, id).catch(() => {});
