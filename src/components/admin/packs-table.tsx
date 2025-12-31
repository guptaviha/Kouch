"use client";

import { useMemo } from 'react';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { TriviaPack } from '@/types/trivia';

interface PacksTableProps {
    packs: TriviaPack[];
}

export function PacksTable({ packs }: PacksTableProps) {
    const columns: ColumnDef<TriviaPack>[] = useMemo(
        () => [
            {
                accessorKey: "id",
                header: "ID",
                cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("id")}</span>,
            },
            {
                accessorKey: "name",
                header: "Name",
                cell: ({ row }) => (
                    <div className="font-medium">{row.getValue("name")}</div>
                ),
            },
            {
                accessorKey: "description",
                header: "Description",
                cell: ({ row }) => (
                    <div className="max-w-[400px] truncate text-muted-foreground" title={row.getValue("description") || ""}>
                        {row.getValue("description") || "-"}
                    </div>
                ),
            },
            {
                id: "question_count",
                header: "Questions",
                cell: ({ row }) => {
                    // Check for questions array or question_ids array
                    const count = row.original.questions?.length ?? row.original.question_ids?.length ?? 0;
                    return <span>{count}</span>;
                }
            },
            {
                accessorKey: "updated_at",
                header: "Last Updated",
                cell: ({ row }) => {
                    return new Date(row.getValue("updated_at")).toLocaleDateString();
                }
            },
        ],
        []
    );

    const table = useReactTable({
        data: packs,
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
                <h3 className="text-lg font-medium">Recent Packs ({packs.length})</h3>
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
