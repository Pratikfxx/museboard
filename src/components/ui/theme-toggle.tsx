"use client";

import { Check, Desktop, Moon, Sun } from "@phosphor-icons/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  useTheme,
  type ThemePreference,
} from "@/components/ui/theme-provider";

const themeOptions = [
  { label: "Light", value: "light", Icon: Sun },
  { label: "Dark", value: "dark", Icon: Moon },
  { label: "System", value: "system", Icon: Desktop },
] satisfies ReadonlyArray<{
  label: string;
  value: ThemePreference;
  Icon: typeof Sun;
}>;

export function ThemeToggle() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const ActiveIcon = resolvedTheme === "dark" ? Moon : Sun;

  useEffect(() => {
    if (!isOpen) return;

    const selectedIndex = themeOptions.findIndex(
      ({ value }) => value === preference,
    );
    itemRefs.current[Math.max(selectedIndex, 0)]?.focus();
  }, [isOpen, preference]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const itemCount = themeOptions.length;
    const currentIndex = itemRefs.current.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowDown":
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount;
        break;
      case "ArrowUp":
        nextIndex = currentIndex < 0 ? itemCount - 1 : (currentIndex - 1 + itemCount) % itemCount;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = itemCount - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Theme: ${preference}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-butter/25"
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <ActiveIcon aria-hidden="true" size={19} weight="regular" />
        <span>Theme</span>
      </button>

      {isOpen ? (
        <div
          aria-label="Theme preference"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-40 rounded-2xl border border-border bg-surface p-1.5 text-ink shadow-lg"
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          role="menu"
        >
          {themeOptions.map(({ Icon, label, value }, index) => {
            const selected = preference === value;

            return (
              <button
                aria-checked={selected}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-medium transition hover:bg-butter/25 data-[selected=true]:bg-butter/35"
                data-selected={selected}
                key={value}
                onClick={() => {
                  setPreference(value);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                role="menuitemradio"
                type="button"
              >
                <Icon aria-hidden="true" size={18} weight="regular" />
                <span className="flex-1">{label}</span>
                {selected ? (
                  <Check aria-hidden="true" size={16} weight="bold" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
