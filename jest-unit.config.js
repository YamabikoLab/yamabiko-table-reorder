const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...defaultConfig,
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.test.{ts,tsx}',
		'!src/**/*.test-utils.ts',
		'!src/types/**',
		'!src/index.tsx',
		'!src/reorder/row-reorder/dnd-kit-poc.ts',
		'!src/reorder/column-reorder/dnd-kit-poc.ts',
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
		'^@/reorder/row-reorder/dnd-kit-poc$':
			'<rootDir>/src/reorder/row-reorder/dnd-kit-poc.test-utils.ts',
		'^@/reorder/column-reorder/dnd-kit-poc$':
			'<rootDir>/src/reorder/column-reorder/dnd-kit-poc.test-utils.ts',
		'^@/(.*)$': '<rootDir>/src/$1',
	},
	testPathIgnorePatterns: [
		...( defaultConfig.testPathIgnorePatterns ?? [] ),
		'<rootDir>/scripts/architecture/',
		'<rootDir>/.architecture-build/',
	],
};
