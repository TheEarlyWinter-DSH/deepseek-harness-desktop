window.__ModuleLoader__.load({
  id: "@deepseek-ai/dsh-skill-loader",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // Client-side Skill Indicator & Quick Inspection for DSH Web UI
    let activeSkills = [];

    async function fetchSkills() {
      try {
        const res = await fetch("/api/dsh-skills/list");
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && Array.isArray(data.skills)) {
          activeSkills = data.skills;
        }
      } catch {}
    }

    function apply(ctx) {
      if (typeof window !== "undefined") {
        fetchSkills();
        window.dshGetSkills = () => activeSkills;
      }
    }

    exports.apply = apply;
    exports.getSkills = () => activeSkills;
    return module.exports;
  }
});
