import adapter from '@sveltejs/adapter-vercel';

const githubPagesBase = process.env.GITHUB_PAGES === 'true'
	? '/Hurling-stats-industrial'
	: '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		warningFilter: (warning) => !warning.code.startsWith('a11y')
	},
	kit: {
		adapter: adapter(),
		paths: {
			base: githubPagesBase
		},
		serviceWorker: {
			register: false
		}
	}
};

export default config;
