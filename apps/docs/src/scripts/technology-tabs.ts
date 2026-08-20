/*
 * Technology tab wiring, shared by ComponentDemo and ChartDemo.
 *
 * Lived inline in ComponentDemo's <script>. Chart pages render only ChartDemo,
 * so on those pages the tabs had no wiring at all — which is part of why their
 * "Show code" was a single HTML block rather than a tab strip.
 *
 * Binding is guarded per container by __technologyTabsBound, and the
 * localStorage key is shared, so every strip on a page (TechnologyTabs,
 * ComponentDemo, ChartDemo) stays on the same technology.
 */
export function setupDemoTechnologyTabs() {
  const STORAGE_KEY = "awc-ui-docs-technology";

  const activateTab = (container: Element, tabId: string) => {
    container.querySelectorAll<HTMLElement>('[role="tab"]').forEach((btn) => {
      const isActive = btn.getAttribute("data-tab") === tabId;
      btn.setAttribute("aria-selected", String(isActive));
      btn.classList.toggle("technology-tabs__tab--active", isActive);
      btn.tabIndex = isActive ? 0 : -1;
    });
    container.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach((panel) => {
      const isActive = panel.getAttribute("data-panel") === tabId;
      panel.classList.toggle("technology-tabs__panel--active", isActive);
      if (isActive) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });
  };

  const saved = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();

  document.querySelectorAll<HTMLElement>("[data-technology-tabs]").forEach((container) => {
    if (container.dataset.technologyTabsBound === "true") return;
    container.dataset.technologyTabsBound = "true";

    if (saved && container.querySelector(`[data-tab="${saved}"]`)) {
      activateTab(container, saved);
    }

    container.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-tab");
        if (!id) return;
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch {
          /* ignore — private mode / storage disabled */
        }
        document
          .querySelectorAll<HTMLElement>("[data-technology-tabs]")
          .forEach((c) => {
            if (c.querySelector(`[data-tab="${id}"]`)) activateTab(c, id);
          });
      });

      btn.addEventListener("keydown", (event) => {
        const tabsInContainer = Array.from(
          container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
        );
        const idx = tabsInContainer.indexOf(btn);
        let next = -1;
        if (event.key === "ArrowRight")
          next = (idx + 1) % tabsInContainer.length;
        else if (event.key === "ArrowLeft")
          next = (idx - 1 + tabsInContainer.length) % tabsInContainer.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabsInContainer.length - 1;
        if (next >= 0) {
          event.preventDefault();
          tabsInContainer[next].click();
          tabsInContainer[next].focus();
        }
      });
    });

    container
      .querySelectorAll<HTMLButtonElement>(".technology-tabs__copy")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const code = btn.getAttribute("data-copy") || "";
          try {
            await navigator.clipboard.writeText(code);
          } catch {
            return;
          }
          btn.classList.add("technology-tabs__copy--copied");
          const label = btn.querySelector(".technology-tabs__copy-label");
          if (label) label.textContent = "Copied!";
          window.setTimeout(() => {
            btn.classList.remove("technology-tabs__copy--copied");
            if (label) label.textContent = "Copy";
          }, 1500);
        });
      });
  });
}
