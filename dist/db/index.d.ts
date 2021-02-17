import { DbOpts, DB } from './core';
declare function useDB(autoFetch: boolean, opts: DbOpts): Promise<any>;
declare function useDB(opts: DbOpts): DB;
declare function useFetch(url: string): Promise<any>;
declare function useFetch(options: DbOpts): Promise<any>;
export { DB, useDB, useFetch };
export default DB;
