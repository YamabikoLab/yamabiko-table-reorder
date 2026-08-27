const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...defaultConfig,
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.test.{ts,tsx}',
		'!src/**/*.test-utils.ts',
		'!src/types/**',
		'!src/index.tsx',
	],
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80,
		},
	},
	moduleNameMapper: {
		...( defaultConfig.moduleNameMapper ?? {} ),
		'^@/(.*)$': '<rootDir>/src/$1',
	},
	testPathIgnorePatterns: [
		...( defaultConfig.testPathIgnorePatterns ?? [] ),
		'<rootDir>/scripts/architecture/',
	],
};
