import typescript from "rollup-plugin-typescript"

export default {
    input: 'db/index.ts',
    output: [
        { name: 'rexdb', file: 'lib/rexdb.js', format: 'cjs', sourcemap: false },
        { name: 'rexdb', file: 'lib/rexdb.esm.js', format: 'umd', sourcemap: false }
    ],
    plugins: [
        typescript({
            exclude: 'node_modules/**',
            typescript: require('typescript')
        })
    ]
}