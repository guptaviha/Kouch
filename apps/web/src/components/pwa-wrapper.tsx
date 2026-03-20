"use client"

import * as React from "react";

type PWAWrapperProps = {
    children: React.ReactNode;
};
export function PWAWrapper({ children }: PWAWrapperProps) {
    React.useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none',
            })
                .then((registration) => console.log(`Service worker registered with scope ${registration.scope}`))
                .catch((error) => console.log(`Service Worker registration failed' ${error}`));
        }
    }, []);
    return <>{children}</>
}
