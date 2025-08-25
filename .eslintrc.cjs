module.exports = {
  root: true,
  ignorePatterns: ['dist','node_modules'],
  rules: {
    'no-restricted-imports': [
      'error',
      { patterns: ['../../*','../../../*'] }
    ]
  }
};
