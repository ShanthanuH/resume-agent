"use client";

import { useEffect, useState, type Dispatch } from "react";
import type { RunEvent } from "@/lib/run-machine";

/**
 * True while a file is being dragged over the page. A file dropped anywhere on
 * the page is taken, not only one dropped on the box: aiming is hard, and a
 * near miss would otherwise make the browser leave the page to open the PDF.
 */
export function useFileDrop(dispatch: Dispatch<RunEvent>): boolean {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    // Dragging text or a link also fires these events. Only files matter here.
    const carriesFile = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const over = (event: DragEvent) => {
      if (!carriesFile(event)) return;
      event.preventDefault(); // without this the browser refuses the drop
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      // relatedTarget is null only when the drag leaves the window itself.
      if (event.relatedTarget === null) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!carriesFile(event)) return;
      event.preventDefault(); // stop the browser from opening the file itself
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file) dispatch({ type: "file_added", file });
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [dispatch]);
  return dragging;
}
