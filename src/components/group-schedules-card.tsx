"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  ChevronRight,
  Flag,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  createGroupSchedule,
  deleteGroupSchedule,
  toggleMilestoneCheckin,
  type GroupScheduleWithMilestones,
} from "@/lib/actions/schedules";
import { getDisplayName, getInitials } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { TitlesResponse } from "@/types/pocketbase-types";

interface GroupSchedulesCardProps {
  groupId: string;
  schedules: GroupScheduleWithMilestones[];
  titles: TitlesResponse[];
  isOwner?: boolean;
  isMember?: boolean;
  memberCount: number;
}

export function GroupSchedulesCard({
  groupId,
  schedules,
  titles,
  isOwner = false,
  isMember = true,
  memberCount,
}: GroupSchedulesCardProps) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Form states for creating schedule
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [titleId, setTitleId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [milestones, setMilestones] = useState<
    { title: string; targetDate: string; targetUnit: string }[]
  >([
    { title: "", targetDate: "", targetUnit: "" },
    { title: "", targetDate: "", targetUnit: "" },
  ]);

  const handleAddMilestoneInput = () => {
    setMilestones([...milestones, { title: "", targetDate: "", targetUnit: "" }]);
  };

  const handleRemoveMilestoneInput = (index: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleUpdateMilestoneInput = (
    index: number,
    field: "title" | "targetDate" | "targetUnit",
    value: string,
  ) => {
    const next = [...milestones];
    next[index][field] = value;
    setMilestones(next);
  };

  const handleCreateSchedule = () => {
    if (!name.trim()) return;
    const validMilestones = milestones.filter((m) => m.title.trim().length > 0);
    if (validMilestones.length === 0) {
      toast.error(t.common.error);
      return;
    }

    startTransition(async () => {
      try {
        await createGroupSchedule(groupId, {
          name,
          description: description || undefined,
          titleId: titleId || undefined,
          startDate: startDate || undefined,
          targetDate: targetDate || undefined,
          milestones: validMilestones,
        });

        toast.success(t.schedules.scheduleCreated);
        setCreateDialogOpen(false);
        // Reset
        setName("");
        setDescription("");
        setTitleId("");
        setStartDate("");
        setTargetDate("");
        setMilestones([
          { title: "", targetDate: "", targetUnit: "" },
          { title: "", targetDate: "", targetUnit: "" },
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t.common.error;
        toast.error(msg);
      }
    });
  };

  const handleToggleCheckin = (milestoneId: string, scheduleId: string) => {
    if (!isMember) return;
    startTransition(async () => {
      try {
        await toggleMilestoneCheckin(milestoneId, groupId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t.common.error;
        toast.error(msg);
      }
    });
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    if (!confirm(t.schedules.deleteScheduleConfirm)) return;
    startTransition(async () => {
      try {
        await deleteGroupSchedule(scheduleId, groupId);
        toast.success(t.schedules.scheduleDeleted);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t.common.error;
        toast.error(msg);
      }
    });
  };

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <div>
              <CardTitle className="text-sm font-semibold">
                {t.schedules.schedulesTitle}
              </CardTitle>
              <CardDescription className="text-xs">
                {t.schedules.schedulesSubtitle}
              </CardDescription>
            </div>
          </div>

          {isOwner && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger
                render={
                  <Button size="xs" variant="outline" className="gap-1.5 font-medium">
                    <Plus className="size-3.5" />
                    <span>{t.schedules.createSchedule}</span>
                  </Button>
                }
              />
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold">
                    {t.schedules.createScheduleTitle}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {t.schedules.schedulesSubtitle}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t.schedules.scheduleName}</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. September Book Club Reading Rhythm"
                      className="h-9 text-xs"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">{t.schedules.scheduleDesc}</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. We will read 5 chapters a week and hold a discussion on Discord every Sunday evening."
                      className="text-xs min-h-[50px] resize-none"
                    />
                  </div>

                  {/* Linked Title Selection */}
                  {titles.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">{t.schedules.linkedTitle}</Label>
                      <select
                        value={titleId}
                        onChange={(e) => setTitleId(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                      >
                        <option value="">-- {t.schedules.noLinkedTitle} --</option>
                        {titles.map((tItem) => (
                          <option key={tItem.id} value={tItem.id}>
                            {tItem.title} {tItem.creator ? `(${tItem.creator})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t.schedules.startDate}</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t.schedules.targetDate}</Label>
                      <Input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Milestones Setup */}
                  <div className="space-y-2.5 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        {t.schedules.milestonesHeading}
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={handleAddMilestoneInput}
                        className="gap-1 text-primary text-xs"
                      >
                        <Plus className="size-3" />
                        <span>{t.schedules.addMilestone}</span>
                      </Button>
                    </div>

                    <div className="space-y-2.5">
                      {milestones.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20"
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={m.title}
                              onChange={(e) =>
                                handleUpdateMilestoneInput(idx, "title", e.target.value)
                              }
                              placeholder={t.schedules.milestoneTitlePlaceholder}
                              className="h-8 text-xs"
                            />
                            <div className="flex gap-1.5">
                              <Input
                                value={m.targetUnit}
                                onChange={(e) =>
                                  handleUpdateMilestoneInput(idx, "targetUnit", e.target.value)
                                }
                                placeholder={t.schedules.milestoneUnitPlaceholder}
                                className="h-8 text-xs flex-1"
                              />
                              <Input
                                type="date"
                                value={m.targetDate}
                                onChange={(e) =>
                                  handleUpdateMilestoneInput(idx, "targetDate", e.target.value)
                                }
                                className="h-8 text-xs w-32"
                              />
                            </div>
                          </div>
                          {milestones.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => handleRemoveMilestoneInput(idx)}
                              className="size-7 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreateDialogOpen(false)}
                    >
                      {t.common.close}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending || !name.trim()}
                      onClick={handleCreateSchedule}
                      className="gap-1.5"
                    >
                      {isPending && <Loader2 className="size-3.5 animate-spin" />}
                      <span>{t.schedules.createSchedule}</span>
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {schedules.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border/70 bg-card/40 space-y-2">
            <Sparkles className="size-5 text-muted-foreground mx-auto" />
            <p className="text-xs font-medium text-foreground">
              {t.schedules.noSchedules}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              {t.schedules.noSchedulesDesc}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="p-4 rounded-xl border border-border/70 bg-card space-y-4 shadow-2xs"
              >
                {/* Schedule Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {schedule.name}
                      </h4>
                      {schedule.titleRecord && (
                        <Badge variant="outline" className="text-[10px] py-0 px-2 font-normal truncate max-w-[160px]">
                          {schedule.titleRecord.title}
                        </Badge>
                      )}
                    </div>
                    {schedule.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {schedule.description}
                      </p>
                    )}
                  </div>

                  {isOwner && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      disabled={isPending}
                      className="size-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      title={t.schedules.scheduleDeleted}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                {/* Milestone Stepper Timeline */}
                <div className="space-y-2.5 pt-1">
                  {schedule.milestones.map((m, idx) => {
                    const checkinCount = m.checkins.length;
                    const completionRate =
                      memberCount > 0
                        ? Math.min(100, Math.round((checkinCount / memberCount) * 100))
                        : 0;

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                          m.hasCheckedIn
                            ? "bg-emerald-500/5 border-emerald-500/30"
                            : "bg-muted/20 border-border/50",
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleCheckin(m.id, schedule.id)}
                            disabled={!isMember || isPending}
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border transition-all mt-0.5",
                              m.hasCheckedIn
                                ? "bg-emerald-500 text-white border-emerald-500 shadow-2xs"
                                : "border-border/70 hover:border-primary text-transparent hover:text-muted-foreground",
                            )}
                            title={m.hasCheckedIn ? t.schedules.checkedIn : t.schedules.checkIn}
                          >
                            <CheckCircle2 className="size-3.5" />
                          </button>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <p
                                className={cn(
                                  "text-xs font-medium truncate",
                                  m.hasCheckedIn ? "text-foreground font-semibold" : "text-foreground",
                                )}
                              >
                                {m.title}
                              </p>
                              {m.targetUnit && (
                                <Badge variant="secondary" className="text-[9px] py-0 px-1.5 font-mono">
                                  {m.targetUnit}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              {m.targetDate && (
                                <span className="flex items-center gap-1">
                                  <Clock className="size-2.5" />
                                  <span>{m.targetDate.slice(0, 10)}</span>
                                </span>
                              )}
                              <span>&middot;</span>
                              <span>
                                {t.schedules.membersCompleted
                                  .replace("{completed}", checkinCount.toString())
                                  .replace("{total}", memberCount.toString())}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Avatars of members who reached checkpoint */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          {m.checkins.length > 0 && (
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {m.checkins.slice(0, 4).map((c) => {
                                const u = c.expand?.user;
                                const initials = getInitials(u?.name, u?.email);
                                return (
                                  <Avatar key={c.id} size="sm" className="ring-1 ring-background size-5 text-[9px]">
                                    {u?.avatarUrl && (
                                      <AvatarImage src={u.avatarUrl} alt={getDisplayName(u)} />
                                    )}
                                    <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                                  </Avatar>
                                );
                              })}
                              {m.checkins.length > 4 && (
                                <div className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground ring-1 ring-background">
                                  +{m.checkins.length - 4}
                                </div>
                              )}
                            </div>
                          )}

                          {isMember && (
                            <Button
                              type="button"
                              size="xs"
                              variant={m.hasCheckedIn ? "secondary" : "outline"}
                              onClick={() => handleToggleCheckin(m.id, schedule.id)}
                              disabled={isPending}
                              className={cn(
                                "text-[11px] h-7 px-2.5 gap-1",
                                m.hasCheckedIn && "text-emerald-700 dark:text-emerald-300 font-semibold",
                              )}
                            >
                              {m.hasCheckedIn ? (
                                <>
                                  <CheckCircle2 className="size-3 text-emerald-500" />
                                  <span>{t.schedules.checkedIn}</span>
                                </>
                              ) : (
                                <span>{t.schedules.checkIn}</span>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
