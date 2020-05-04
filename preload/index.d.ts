import { IPreload } from '.'

declare namespace global {
    interface Window {
        Preload:IPreload
    }
}

