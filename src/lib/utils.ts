import { type ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function checkIfExcel(fileName: string) {
  return fileName.toLowerCase().match(/\.(xls|xlsx)$/);
}
