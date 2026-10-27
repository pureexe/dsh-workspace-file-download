/**
 * Browser half of the workspace file download bundle.
 *
 * Registers a download button in two document preview slots:
 *   - `sidebar.right.tab.document.actions`      — next to the reload button in the preview toolbar
 *   - `sidebar.right.tab.document.unpreviewable` — the "Preview is not available" empty state
 *
 * Clicking the button fetches the workspace file through the authenticated
 * `GET /api/file?path=...` endpoint and hands the bytes to the browser via an
 * object-URL anchor click, saving the file with its original base name.
 */
window.__ModuleLoader__.load({
	id: '@local/dsh-workspace-file-download',
	factory: (require) => {
		const React = require('react');
		const h = React.createElement;
		const NS = 'dsh-workspace-file-download';
		const PKG = '@local/dsh-workspace-file-download';

		const EN = {
			'download.label': 'Download file',
			'download.busy': 'Downloading…',
			'error.generic': 'Download failed. Please try again.',
			'error.404': 'File is no longer available.',
			'error.403': 'This file cannot be downloaded.',
			'error.413': 'This file is too large to download.'
		};
		const ZH = {
			'download.label': '下载文件',
			'download.busy': '正在下载…',
			'error.generic': '下载失败，请重试。',
			'error.404': '文件已不可用。',
			'error.403': '无法下载此文件。',
			'error.413': '此文件过大，无法下载。'
		};

		/** Mirror of the document preview's own tool/retry styling, theme tokens only. */
		const CSS = [
			'.wfd_tool{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:6px;line-height:1;display:inline-flex}',
			'.wfd_tool svg{width:15px;height:15px}',
			'.wfd_tool:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
			'.wfd_tool:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}',
			'.wfd_tool[data-wfd-error=true]{color:var(--dsw-alias-state-warn-label)}',
			'.wfd_tool[data-wfd-error=true]:hover{color:var(--dsw-alias-state-warn-label)}',
			'.wfd_empty{height:32px;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);cursor:pointer;background:0 0;flex:none;align-items:center;gap:6px;padding:0 14px 0 12px;font-family:inherit;display:inline-flex}',
			'.wfd_empty svg{width:15px;height:15px;flex:none}',
			'.wfd_empty:hover{background:var(--dsw-alias-interactive-bg-hover)}',
			'.wfd_empty:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}',
			'.wfd_emptyLine{color:var(--dsw-alias-state-warn-label);font-size:var(--dsh-content-font-size-secondary,13px);font-family:var(--dsw-font-family);line-height:1.6;margin:0;max-width:320px}'
		].join('\n');

		/** Idempotent package-owned stylesheet, removed when the plugin is disposed. */
		function ensureStyle() {
			const tagId = PKG + '/styles.css';
			if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
				const tag = document.createElement('style');
				tag.dataset.plugin = PKG;
				tag.dataset.pluginCss = tagId;
				tag.textContent = CSS;
				document.head.appendChild(tag);
			}
			return () => {
				const tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']');
				if (tag) tag.remove();
			};
		}

		/** Last path segment of an absolute POSIX or Windows path. */
		function baseName(absolutePath) {
			const s = String(absolutePath).replace(/\\/g, '/');
			const i = s.lastIndexOf('/');
			return i >= 0 ? s.slice(i + 1) : s;
		}

		function errorKey(status) {
			if (status === 404 || status === 410) return 'error.404';
			if (status === 401 || status === 403) return 'error.403';
			if (status === 413) return 'error.413';
			return 'error.generic';
		}

		/**
		 * Fetch the workspace file and start a browser download of its bytes.
		 * `onState` receives `{ kind: 'busy' | 'ok' | 'error', key? }`.
		 */
		async function downloadFile(absolutePath, onState) {
			const url = new URL('api/file?path=' + encodeURIComponent(absolutePath), document.baseURI).href;
			try {
				const res = await fetch(url, { credentials: 'same-origin' });
				if (!res.ok) {
					onState({ kind: 'error', key: errorKey(res.status) });
					return;
				}
				const blob = await res.blob();
				const objectUrl = URL.createObjectURL(blob);
				try {
					const anchor = document.createElement('a');
					anchor.href = objectUrl;
					anchor.download = baseName(absolutePath);
					document.body.appendChild(anchor);
					anchor.click();
					anchor.remove();
				} finally {
					setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
				}
				onState({ kind: 'ok' });
			} catch (err) {
				console.error('[cordis:' + PKG + '] download failed', err);
				onState({ kind: 'error', key: 'error.generic' });
			}
		}

		function useDownload(absolutePath) {
			const [state, setState] = React.useState({ kind: 'idle' });
			const alive = React.useRef(true);
			React.useEffect(() => {
				alive.current = true;
				return () => {
					alive.current = false;
				};
			}, []);
			const start = React.useCallback(() => {
				if (state.kind === 'busy') return;
				setState({ kind: 'busy' });
				downloadFile(absolutePath, (next) => {
					if (alive.current) setState(next);
				});
			}, [absolutePath, state.kind]);
			return { state, start };
		}

		/** Original 15x15 download glyph; stroke inherits the theme label color. */
		function DownloadIcon() {
			return h('svg', {
				viewBox: '0 0 16 16', width: 15, height: 15, fill: 'none', 'aria-hidden': true
			},
			h('path', { d: 'M8 1.75v8.5', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
			h('path', { d: 'M4.5 6.75L8 10.25 11.5 6.75', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
			h('path', { d: 'M2.75 11.25v.75a1.5 1.5 0 0 0 1.5 1.5h7.5a1.5 1.5 0 0 0 1.5-1.5v-.75', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }));
		}

		/** Toolbar slot: a 28x28 icon button beside the preview reload button. */
		function DownloadTool({ t, absolutePath }) {
			const { state, start } = useDownload(absolutePath);
			const label = state.kind === 'busy' ? t('download.busy') : t('download.label');
			const title = state.kind === 'error' ? t(state.key) : label;
			return h('button', {
				type: 'button',
				className: 'wfd_tool',
				title,
				'aria-label': label,
				disabled: state.kind === 'busy',
				'data-wfd-error': state.kind === 'error' ? 'true' : 'false',
				onClick: start
			}, DownloadIcon());
		}

		/** Empty-state slot: a 32px action button plus a localized failure line. */
		function DownloadEmptyAction({ t, absolutePath }) {
			const { state, start } = useDownload(absolutePath);
			const label = state.kind === 'busy' ? t('download.busy') : t('download.label');
			return h(React.Fragment, null,
			h('button', {
				type: 'button',
				className: 'wfd_empty',
				title: label,
				disabled: state.kind === 'busy',
				onClick: start
			}, DownloadIcon(), h('span', null, label)),
			state.kind === 'error'
				? h('p', { className: 'wfd_emptyLine', role: 'status' }, t(state.key))
				: null);
		}

		return {
			inject: ['slots', 'locale'],
			apply(ctx) {
				ctx.effect(() => ensureStyle(), 'styles');
				ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'locale');
				const t = ctx.locale.bind(NS);
				ctx.slots.inject('sidebar.right.tab.document.actions', () => ctx.slots.register({
					name: 'sidebar.right.tab.document.actions',
					id: 'dsh-workspace-file-download',
					locale: NS,
					inject: () => ({ t })
				}, DownloadTool));
				ctx.slots.inject('sidebar.right.tab.document.unpreviewable', () => ctx.slots.register({
					name: 'sidebar.right.tab.document.unpreviewable',
					id: 'dsh-workspace-file-download',
					locale: NS,
					inject: () => ({ t })
				}, DownloadEmptyAction));
			}
		};
	}
});
