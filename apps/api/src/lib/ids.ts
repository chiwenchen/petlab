import { customAlphabet } from "nanoid";

// URL-safe alphabet, no ambiguous chars (no 0/O/1/l/I)
const alphabet = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

const id21 = customAlphabet(alphabet, 21);
const id12 = customAlphabet(alphabet, 12);

export const newId = () => id21();
export const newShareToken = () => id21();
export const newShortCode = () => id12();
