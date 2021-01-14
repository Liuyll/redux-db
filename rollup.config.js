import typescript from "rollup-plugin-typescript"

export default [{
    input: 'db/index.ts',
    output: [
        { name: 'rexos', file: 'lib/rexos.js', format: 'cjs', sourcemap: false },
        { name: 'rexos', file: 'lib/rexos.esm.js', format: 'umd', sourcemap: false }
    ],
    plugins: [
        typescript({
            exclude: 'node_modules/**',
            typescript: require('typescript')
        })
    ]
},{
    input: 'server/index.ts',
    output: { name: 'server', file: 'lib/proxy.js', format: 'cjs', sourcemap: false },
    plugins: [
        typescript({
            exclude: 'node_modules/**',
            typescript: require('typescript')
        })
    ]
}]