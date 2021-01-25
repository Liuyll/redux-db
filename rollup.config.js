import typescript from 'rollup-plugin-typescript'
import babel from 'rollup-plugin-babel'

export default [{
    input: 'db/index.ts',
    output: [
        { name: 'rexos', file: 'lib/rexos.js', format: 'umd', sourcemap: false, exports: 'named' },
        { name: 'rexos', file: 'lib/rexos.esm.mjs', format: 'es', sourcemap: false, exports: 'named' }
    ],
    plugins: [
        typescript({
            exclude: 'node_modules/**',
            typescript: require('typescript')
        }),
        babel()
    ]
},{
    input: 'server/index.ts',
    output: { name: 'server', file: 'lib/proxy.js', format: 'cjs', sourcemap: false, exports: 'named' },
    plugins: [
        typescript({
            exclude: 'node_modules/**',
            typescript: require('typescript')
        })
    ]
}]