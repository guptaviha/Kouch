// Generic card that everything else can build upon
import { motion, TargetAndTransition, Transition } from 'framer-motion';
import React from 'react';

interface GenericCardProps {
    children: React.ReactNode;
    className?: string;
    initial: TargetAndTransition;
    animate: TargetAndTransition;
    transition?: Transition;
};

export default function GenericCard({ children, className, initial, animate, transition }: GenericCardProps) {
    return (
        <motion.div
            initial={initial}
            animate={animate}
            transition={transition}
            className={`bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 ${className ?? ''}`}
        >
            {children}
        </motion.div>
    );
}