import { copy } from "@/lib/copy";

// One colour and one height per letter, repeating. The colours are the five
// that carry meaning on the site, plus the white of the resume.
const BLOCKS = [
  ["bg-changed", "h-full"],
  ["bg-sheet", "h-[72%]"],
  ["bg-yours", "h-[88%]"],
  ["bg-action", "h-[64%]"],
  ["bg-left-out", "h-[94%]"],
  ["bg-recorded", "h-[78%]"],
];

/**
 * The site's name, built large: each letter is cut out of its own solid block.
 * The blocks differ in height and stand on one line.
 *
 * It is a picture of the name, so it is hidden from screen readers (the header
 * already says the name). Each letter is drawn by CSS from data-letter, which
 * keeps it out of the page's text: copying the page gives the name once.
 */
export function BlockName() {
  const letters = copy.nav_brand.toUpperCase().split("");
  return (
    // overflow-hidden: the blocks rise into place from below this box's bottom
    // edge (see .block-letter in globals.css), and are cut off until they do.
    <div aria-hidden className="flex h-[22svh] min-h-28 items-end gap-1 overflow-hidden sm:h-[30svh]">
      {letters.map((letter, index) => {
        const [colour, height] = BLOCKS[index % BLOCKS.length];
        return (
          <span
            key={index}
            data-letter={letter}
            style={{ "--i": index } as React.CSSProperties}
            // The letter sits at the bottom of its block and is as large as the
            // block is wide (cqw = 1% of the block's width).
            className={`block-letter flex flex-1 items-end justify-center overflow-hidden text-black [container-type:inline-size] before:text-[92cqw] before:font-bold before:leading-[0.8] ${colour} ${height}`}
          />
        );
      })}
    </div>
  );
}
