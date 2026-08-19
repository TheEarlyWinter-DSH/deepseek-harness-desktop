// @deepseek-ai/dsh-third-party-thinking 客户端半边：DSH 设置页的「第三方模型思考强度」栏。
// 命名空间 dsh-third-party-thinking：
//   - enabled：是否启用第三方模型思考强度注入
//   - wireField：OpenAI 兼容 provider 用于承接档位的请求体字段名
// 打包格式与 dsh-client-ui-settings-models 的 lib/client.js 相同。
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-third-party-thinking",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const { jsx, jsxs } = require("react/jsx-runtime");
		const { bindSnapshotSelector } = require("@deepseek-ai/dsh-client-web-react");
		const { Button } = require("@deepseek-ai/dsh-client-ui-primitives");

		const NS = "dsh-third-party-thinking";

		const L = {
			nav: "第三方模型思考强度",
			navSub: "让接入的 OpenAI 兼容第三方模型在模型选择器出现「思考强度」档位（off/high/max），并把所选档位注入到请求体（官方 DeepSeek 与 pi-ai 模型不受影响）。",
			enabledLabel: "启用第三方模型思考强度",
			enabledHint: "默认关闭以避免百炼等严格校验请求体的第三方 API 报参数错误；仅当你的 provider 支持 reasoning_effort（或自定义字段）时开启",
			wireFieldLabel: "请求字段名",
			wireFieldHint: "OpenAI 兼容 provider 用于承接该档位的请求体字段，默认 reasoning_effort；留空则只显示档位控件、不注入参数。例如 opencode-go 套餐内的 DeepSeek Flash/Pro 支持 reasoning_effort——开启注入后即可使用思考强度",
			save: "保存",
			saving: "保存中…",
			saved: "已保存",
			loading: "加载中…",
			unavailable: "设置不可用（需要在本机浏览器中打开）"
		};

		function fieldRow(label, hint, input) {
			return jsxs("div", {
				style: { display: "flex", flexDirection: "column", gap: 4 },
				children: [
					jsx("span", { children: label }),
					input,
					hint ? jsx("span", { style: { fontSize: 12, opacity: 0.65 }, children: hint }) : null
				]
			});
		}

		function ThinkingCard(props) {
			const { useScope, scope } = props;
			let snap = { status: "ready", writable: true, value: {} };
			try {
				if (typeof useScope === "function") {
					snap = useScope((s) => s) || snap;
				}
			} catch (e) {}

			const [enabled, setEnabled] = react.useState(false);
			const [wireField, setWireField] = react.useState("reasoning_effort");
			const [busy, setBusy] = react.useState(false);
			const [saved, setSaved] = react.useState(false);

			react.useEffect(() => {
				if (snap && snap.status === "ready" && snap.value) {
					const v = snap.value;
					setEnabled(v.enabled === true);
					setWireField(v.wireField === undefined ? "reasoning_effort" : String(v.wireField));
				}
			}, [snap && snap.status, snap && snap.value]);

			const save = async () => {
				setBusy(true);
				setSaved(false);
				try {
					const wantEnabled = !!enabled;
					const wantWire = wireField.trim();
					if (scope && typeof scope.set === "function") {
						try {
							await scope.set("enabled", wantEnabled);
							await scope.set("wireField", wantWire);
						} catch (err) {
							console.warn("[dsh-third-party-thinking] scope.set error:", err);
						}
					}
					setSaved(true);
				} finally {
					setBusy(false);
				}
			};

			return jsxs("div", {
				style: { display: "flex", flexDirection: "column", gap: 12 },
				children: [
					fieldRow(L.enabledLabel, L.enabledHint, jsx("input", {
						type: "checkbox",
						checked: enabled,
						onChange: (e) => setEnabled(e.target.checked)
					})),
					fieldRow(L.wireFieldLabel, L.wireFieldHint, jsx("input", {
						type: "text",
						value: wireField,
						style: { padding: "4px 8px", fontFamily: "inherit" },
						onChange: (e) => setWireField(e.target.value)
					})),
					jsxs("div", {
						style: { display: "flex", alignItems: "center", gap: 8 },
						children: [
							jsx(Button, {
								variant: "primary",
								size: "sm",
								disabled: busy,
								onClick: save,
								children: busy ? L.saving : L.save
							}),
							saved ? jsx("span", { children: L.saved }) : null
						]
					})
				]
			});
		}

		function ThinkingSettingsCard(props) {
			const { useScope, scope } = props;
			return jsxs("div", {
				style: { display: "flex", flexDirection: "column", gap: 16, padding: 16, maxWidth: 560 },
				children: [
					jsx("h2", { children: L.navSub }),
					jsx(ThinkingCard, { useScope, scope })
				]
			});
		}

		function apply(ctx) {
			const scope = ctx.settingsScope.bind({ namespace: NS });
			const useScope = bindSnapshotSelector(scope);
			const injected = () => ({ useScope, scope });
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-third-party-thinking",
				order: 70,
				label: () => L.nav,
				inject: injected
			}, ThinkingSettingsCard), "dsh-third-party-thinking: settings section entry");
		}

		const inject = ["slots", "connection", "remote", "settingsScope"];
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});