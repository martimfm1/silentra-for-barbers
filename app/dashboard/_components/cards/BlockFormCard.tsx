'use client';

//utils
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { type BlockScheduleFormProps } from '@/types';

//UI
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, CalendarOff } from 'lucide-react';

export function BlockScheduleForm({
  professionals,
  loading,
  blockFormData,
  setBlockFormData,
  onSubmit,
}: BlockScheduleFormProps) {
  return (
    <Card className="border border-red-500/20 bg-black/40 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200">
      <CardHeader>
        <CardTitle className="text-red-400 flex gap-2">
          <CalendarOff className="size-5" /> Block Schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 items-end"
        >
          {/* Who is absent */}
          <div className="grid gap-2">
            <label className="text-xs text-zinc-400">Who is absent?</label>
            <Select
              value={blockFormData.professional_id}
              onValueChange={(val) =>
                setBlockFormData({ ...blockFormData, professional_id: val })
              }
            >
              <SelectTrigger className="bg-zinc-900 border-white/10 text-white cursor-pointer">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectGroup>
                  {professionals.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Block Date */}
          <div className="grid gap-2">
            <label className="text-xs text-zinc-400">Block Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'justify-start bg-white/5 border border-white/10 text-white hover:bg-white/10 cursor-pointer',
                    !blockFormData.start_date && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {blockFormData.start_date
                    ? format(
                        new Date(blockFormData.start_date + 'T00:00:00'),
                        'PPP',
                      )
                    : 'Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800">
                <Calendar
                  mode="single"
                  selected={
                    blockFormData.start_date
                      ? new Date(blockFormData.start_date + 'T00:00:00')
                      : undefined
                  }
                  onSelect={(d) =>
                    d &&
                    setBlockFormData({
                      ...blockFormData,
                      start_date: format(d, 'yyyy-MM-dd'),
                    })
                  }
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Start Time */}
          <div className="grid gap-2">
            <label className="text-xs text-zinc-400">Start Time</label>
            <input
              type="time"
              required
              className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white color-scheme-dark cursor-pointer"
              value={blockFormData.start_time}
              onChange={(e) =>
                setBlockFormData({
                  ...blockFormData,
                  start_time: e.target.value,
                })
              }
            />
          </div>

          {/* End Time */}
          <div className="grid gap-2">
            <label className="text-xs text-zinc-400">End Time</label>
            <input
              type="time"
              required
              className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white color-scheme-dark cursor-pointer"
              value={blockFormData.end_time}
              onChange={(e) =>
                setBlockFormData({ ...blockFormData, end_time: e.target.value })
              }
            />
          </div>

          {/* Reason */}
          <div className="grid gap-2 md:col-span-2 lg:col-span-2">
            <label className="text-xs text-zinc-400">Reason</label>
            <input
              placeholder="Reason for the block"
              className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white"
              value={blockFormData.reason || ''}
              onChange={(e) =>
                setBlockFormData({ ...blockFormData, reason: e.target.value })
              }
            />
          </div>

          {/* Submit */}
          <Button
            aria-label={loading ? "A guardar bloqueio" : "Guardar bloqueio"}
            type="submit"
            disabled={loading}
            variant="ghost"
            className="bg-red-600 hover:bg-red-500 text-white h-10 w-full cursor-pointer"
          >
            {loading ? <Spinner className="mr-2" /> : 'Block Time'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
