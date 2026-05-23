import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
	variable: "--font-jetbrains-mono",
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
			className={`${inter.variable} ${jetbrainsMono.variable}`}
			suppressHydrationWarning
		>
			<body className="flex h-screen w-screen overflow-hidden">
				<Providers>
					<Sidebar />
					<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
						<main className="flex-1 overflow-auto">
							<div className="mx-auto w-full max-w-7xl px-8 py-8">
								{children}
							</div>
						</main>
					</div>
				</Providers>
			</body>
		</html>
	);
}
