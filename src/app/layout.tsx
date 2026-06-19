import type { Metadata } from 'next'; import './globals.css'; import { Header } from '@/components/Header'; import { Footer } from '@/components/Footer'; import { siteConfig } from '@/lib/config';
export const metadata: Metadata = { title: { default: siteConfig.shopName, template: `%s | ${siteConfig.shopName}` }, description: siteConfig.tagline };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Header/><main>{children}</main><Footer/></body></html>}
