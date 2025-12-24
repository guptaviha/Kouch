"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Gamepad2, Laptop, Smartphone, Trophy, Brain, ArrowRight, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import { useGameStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import Header from "@/components/header";
import { GamePack } from "@/types/games";

export default function Home() {
    const router = useRouter();
    const setSelectedPack = useGameStore((s) => s.setSelectedPack);

    const handlePlayGame = (pack: GamePack) => {
        setSelectedPack(pack);
        router.push(`/host/${pack}`);
    };

    const scrollToGames = () => {
        const gamesSection = document.getElementById('games-section');
        if (gamesSection) {
            gamesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 100,
            },
        },
    };

    return (
        <main className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
            {/* Navigation */}
            <div className="p-8 max-w-3xl mx-auto relative">
                <Header />
            </div>

            {/* Hero Section */}
            <motion.section
                className="relative flex flex-col items-center justify-center text-center px-4 py-16 md:py-32 max-w-5xl mx-auto"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Background decorative elements */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10" />

                <motion.h1
                    className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent"
                    variants={itemVariants}
                >
                    Game Night, <br className="hidden md:block" />
                    <span className="text-primary">Reinvented.</span>
                </motion.h1>

                <motion.p
                    className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl leading-relaxed"
                    variants={itemVariants}
                >
                    Turn your living room into a game show stage. Use your phone as the controller and the TV as the main display.
                </motion.p>

                <motion.div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto" variants={itemVariants}>
                    <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 h-auto shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" onClick={scrollToGames}>
                        <Laptop className="mr-2 w-5 h-5" />
                        Host Party
                    </Button>
                    <Link href="/player" className="w-full sm:w-auto">
                        <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 h-auto hover:bg-secondary/80">
                            <Smartphone className="mr-2 w-5 h-5" />
                            Join Room
                        </Button>
                    </Link>
                </motion.div>
            </motion.section>

            {/* How It Works */}
            <section className="py-24 bg-secondary/30 border-y border-border/50">
                <div className="max-w-7xl mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">How It Works</h2>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                            No apps to install. No complicated setup.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
                        {[
                            {
                                icon: <Laptop className="w-10 h-10 text-blue-500" />,
                                title: "Host on Big Screen",
                                description: "Open Kouch on your laptop or smart TV. This becomes the main game board that everyone watches.",
                                step: "01"
                            },
                            {
                                icon: <Smartphone className="w-10 h-10 text-green-500" />,
                                title: "Join with Phones",
                                description: "Players scan the QR code or enter the room code to join. Your phone is your controller.",
                                step: "02"
                            },
                            {
                                icon: <Trophy className="w-10 h-10 text-yellow-500" />,
                                title: "Compete & Win",
                                description: "Play real-time mini-games, answer trivia, and solve puzzles to claim the crown.",
                                step: "03"
                            },
                        ].map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.2 }}
                                className="relative bg-card p-8 rounded-2xl shadow-sm border border-border/50 hover:border-primary/50 transition-colors group"
                            >
                                <div className="absolute -top-4 -right-4 text-6xl font-bold text-secondary opacity-50 select-none">
                                    {step.step}
                                </div>
                                <div className="mb-6 p-4 bg-background rounded-xl shadow-sm w-fit group-hover:scale-110 transition-transform duration-300">
                                    {step.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Games Section */}
            <section id="games-section" className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Games</h2>
                        <p className="text-muted-foreground text-lg">Choose your challenge.</p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        <motion.div
                            whileHover={{ y: -5 }}
                            className="group relative overflow-hidden rounded-3xl border border-border bg-card hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                                <Brain className="w-48 h-48" />
                            </div>
                            <div className="p-8 md:p-10 relative z-10 flex flex-col h-full">
                                <div className="mb-6 p-3 bg-purple-100 dark:bg-purple-900/20 w-fit rounded-xl">
                                    <Brain className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                                </div>
                                <h3 className="text-3xl font-bold mb-3">Trivia Quiz</h3>
                                <p className="text-muted-foreground mb-8 text-lg flex-grow">
                                    Test your knowledge across various categories. Fast fingers and smart brains win!
                                </p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
                                    <div className="flex items-center gap-1">
                                        <Users className="w-4 h-4" /> 1-10 Players
                                    </div>
                                    <div className="w-1 h-1 bg-border rounded-full" />
                                    <div>15 Mins</div>
                                </div>
                                <Button
                                    onClick={() => handlePlayGame('trivia')}
                                    className="w-full text-lg py-6 bg-purple-600 hover:bg-purple-700 text-white border-none"
                                >
                                    Play Trivia
                                </Button>
                            </div>
                        </motion.div>

                        <motion.div
                            whileHover={{ y: -5 }}
                            className="group relative overflow-hidden rounded-3xl border border-border bg-card hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                                <Gamepad2 className="w-48 h-48" />
                            </div>
                            <div className="p-8 md:p-10 relative z-10 flex flex-col h-full">
                                <div className="mb-6 p-3 bg-orange-100 dark:bg-orange-900/20 w-fit rounded-xl">
                                    <Gamepad2 className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                                </div>
                                <h3 className="text-3xl font-bold mb-3">Rebus</h3>
                                <p className="text-muted-foreground mb-8 text-lg flex-grow">
                                    Decipher the hidden meaning behind the pictures. A visual puzzle game for everyone.
                                </p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
                                    <div className="flex items-center gap-1">
                                        <Users className="w-4 h-4" /> 1-10 Players
                                    </div>
                                    <div className="w-1 h-1 bg-border rounded-full" />
                                    <div>20 Mins</div>
                                </div>
                                <Button
                                    onClick={() => handlePlayGame('rebus')}
                                    className="w-full text-lg py-6 bg-orange-600 hover:bg-orange-700 text-white border-none"
                                >
                                    Play Rebus
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 text-center text-muted-foreground border-t border-border bg-secondary/10">
                <p>© {new Date().getFullYear()} Kouch. Built for the ultimate party.</p>
            </footer>
        </main>
    );
}

