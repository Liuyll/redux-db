interface IUtils {
    extend(target: unknown, ext: object, isDeep?: boolean): any;
    safeJsonParse(target: string): object;
    safeJsonStringify(target: object): string;
    isSupportPreload(): boolean;
    isArray<T = any>(t: any): t is Array<T>;
    isObject<T = any>(t: any): t is Object;
}
declare const _: IUtils;
export default _;
