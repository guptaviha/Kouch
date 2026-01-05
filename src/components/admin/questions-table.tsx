"use client";

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { Copy, Eye, EyeOff } from 'lucide-react';

import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import useLocalStorage from "@/hooks/useLocalStorage";
import type { TriviaQuestion } from '@/types/game-types';

interface QuestionsTableProps {
    questions: TriviaQuestion[];
}

export function QuestionsTable({ questions }: QuestionsTableProps) {
    const router = useRouter();
    const [showAnswers, setShowAnswers] = useLocalStorage<boolean>('show-answers-admin', false);

    const columns: ColumnDef<TriviaQuestion>[] = useMemo(
        () => [
            {
                accessorKey: "id",
                header: "ID",
                cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("id")}</span>,
            },
            {
                accessorKey: "prompt",
                header: "Prompt",
                cell: ({ row }) => (
                    <div className="max-w-[400px] truncate" title={row.getValue("prompt")}>
                        {row.getValue("prompt")}
                    </div>
                ),
            },
            {
                accessorKey: "question_type",
                header: "Type",
                cell: ({ row }) => {
                    const type = row.getValue("question_type") as string;
                    return <span className="capitalize">{type.replace('_', ' ')}</span>;
                }
            },
            {
                accessorKey: "difficulty",
                header: "Diff",
                cell: ({ row }) => row.getValue("difficulty"),
            },
            // Logical "Answer" column that handles different question types
            {
                id: "answer",
                header: "Answer",
                cell: ({ row }) => {
                    const q = row.original;
                    if (!showAnswers) return <span className="text-muted-foreground">***</span>;

                    let answerText = '';
                    if (q.question_type === 'multiple_choice' && q.choices && q.correct_choice_index !== null) {
                        answerText = q.choices[q.correct_choice_index];
                    } else if ((q.question_type === 'open_ended' || q.question_type === 'multi_part') && q.correct_answers) {
                        answerText = q.correct_answers.join(', ');
                    }

                    return (
                        <div className="max-w-[200px] truncate" title={answerText}>
                            {answerText}
                        </div>
                    );
                },
            },
            {
                accessorKey: "created_at",
                header: "Created At",
                cell: ({ row }) => {
                    return new Date(row.getValue("created_at")).toLocaleDateString();
                }
            },
        ],
        [showAnswers]
    );

    const table = useReactTable({
        data: questions,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: {
                pageSize: 10,
            }
        }
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Recent Questions ({questions.length})</h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAnswers(prev => !prev)}
                >
                    {showAnswers ? (
                        <>
                            <EyeOff className="mr-2 h-4 w-4" />
                            Hide Answers
                        </>
                    ) : (
                        <>
                            <Eye className="mr-2 h-4 w-4" />
                            Show Answers
                        </>
                    )}
                </Button>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="cursor-pointer transition hover:bg-muted/60"
                                    onClick={() => router.push(`/admin/contribute/question/${row.original.id}`)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    Next
                </Button>
            </div>
        </div>
    );
}
