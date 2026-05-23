import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TopNav } from "@/components/top-nav";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "design-to-fullstack",
	description: "Turn designs into full-stack apps.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full`}
			suppressHydrationWarning
		>
			<body className="flex min-h-screen flex-col">
				<Providers>
					<TopNav />
					<main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
						{children}
					</main>
				</Providers>
			</body>
		</html>
	);
}
