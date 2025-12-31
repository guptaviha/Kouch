"use client";

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PacksTab from './packs-tab';
import QuestionsTab from './questions-tab';
import type { TriviaQuestion, TriviaTag } from '@/types/trivia';

export default function AdminContributePage() {
  const [tags, setTags] = useState<TriviaTag[]>([]);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);

  const refreshTags = useCallback(async (query?: string) => {
    const search = query ? `?q=${encodeURIComponent(query)}` : '';
    const response = await fetch(`/api/admin/trivia/tags${search}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as TriviaTag[];
    setTags(data);
  }, []);

  const refreshQuestions = useCallback(async () => {
    const response = await fetch('/api/admin/trivia/questions?limit=100', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as TriviaQuestion[];
    setQuestions(data);
  }, []);

  useEffect(() => {
    void refreshTags();
    void refreshQuestions();
  }, [refreshTags, refreshQuestions]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50"
      >
        Content Contribution
      </motion.h1>

      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="inline-flex items-center gap-3 rounded-lg border border-gray-200/70 bg-white/70 p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
          <TabsTrigger value="questions" className="rounded-lg px-5 py-2.5 text-base font-semibold text-gray-800 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 dark:text-gray-200 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-50">
            Questions
          </TabsTrigger>
          <TabsTrigger value="packs" className="rounded-lg px-5 py-2.5 text-base font-semibold text-gray-800 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900 dark:text-gray-200 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-50">
            Packs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4">
          <QuestionsTab tags={tags} onRefreshTags={refreshTags} onRefreshQuestions={refreshQuestions} />
        </TabsContent>

        <TabsContent value="packs" className="mt-4">
          <PacksTab questions={questions} onRefreshQuestions={refreshQuestions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
