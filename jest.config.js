const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...defaultConfig,
	moduleNameMapper: {
		...( defaultConfig.moduleNameMapper ?? {} ),
		'^@/(.*)$': '<rootDir>/src/$1',
	},
};
