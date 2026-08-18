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
  Flame,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MilestoneCampfireDialog } from "@/components/milestone-campfire-dialog";
import {
  createGroupSchedule,
  deleteGroupSchedule,
  toggleMilestoneCheckin,
  type GroupScheduleWithMilestones,
  type MilestoneWithCheckins,
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
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [campfireMilestone, setCampfireMilestone] = useState<{
    milestone: MilestoneWithCheckins;
    scheduleName: string;
  } | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [titleId, setTitleId] = useState("");
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
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error(t.schedules.scheduleName);
      return;
    }
    const validMilestones = milestones.filter((m) => m.title.trim().length > 0);
    if (validMilestones.length === 0) {
      toast.error(t.schedules.addMilestone);
      return;
    }

    startTransition(async () => {
      const res = await createGroupSchedule(groupId, {
        name: cleanName,
        description: description.trim() || undefined,
        titleId: titleId.trim() || undefined,
        startDate: startDate || undefined,
        targetDate: targetDate || undefined,
        milestones: validMilestones,
      });

      if (!res.success) {
        toast.error(res.error, {
          description: res.traceId ? `Referans Kodu: ${res.traceId}` : undefined,
        });
        return;
      }

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
    });
  };

  const handleToggleCheckin = (milestoneId: string, scheduleId: string) => {
    if (!isMember) return;
    startTransition(async () => {
      const res = await toggleMilestoneCheckin(milestoneId, groupId);
      if (!res.success) {
        toast.error(res.error, {
          description: res.traceId ? `Referans Kodu: ${res.traceId}` : undefined,
        });
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!scheduleToDelete) return;
    const targetId = scheduleToDelete;
    setScheduleToDelete(null);

    startTransition(async () => {
      const res = await deleteGroupSchedule(targetId, groupId);
      if (!res.success) {
        toast.error(res.error, {
          description: res.traceId ? `Referans Kodu: ${res.traceId}` : undefined,
        });
      } else {
        toast.success(t.schedules.scheduleDeleted);
      }
    });
  };

  return (
    <>
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

            {isMember && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger
                  render={
                    <Button size="xs" variant="outline" className="gap-1 text-xs">
                      <Plus className="size-3.5" />
                      <span>{t.schedules.createSchedule}</span>
                    </Button>
                  }
                />
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                      {t.schedules.createSchedule}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {t.schedules.schedulesSubtitle}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t.schedules.scheduleName} *</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Örn: Eylül Ayı Kitap Kulübü Okuma Ritmi"
                        className="h-9 text-xs"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">{t.schedules.scheduleDesc}</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Örn: Haftada 5 bölüm okuyup pazar günleri toplanıyoruz."
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

                    {/* Milestones / Checkpoints */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">
                          {t.schedules.milestonesHeading}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={handleAddMilestoneInput}
                          className="text-xs text-primary gap-1 h-7"
                        >
                          <Plus className="size-3" />
                          <span>{t.schedules.addMilestone}</span>
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {milestones.map((m, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-2 relative"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                #{idx + 1}
                              </span>
                              {milestones.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => handleRemoveMilestoneInput(idx)}
                                  className="size-6 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              )}
                            </div>

                            <Input
                              value={m.title}
                              onChange={(e) =>
                                handleUpdateMilestoneInput(idx, "title", e.target.value)
                              }
                              placeholder={t.schedules.milestoneTitlePlaceholder}
                              className="h-8 text-xs"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={m.targetUnit}
                                onChange={(e) =>
                                  handleUpdateMilestoneInput(idx, "targetUnit", e.target.value)
                                }
                                placeholder={t.schedules.milestoneUnitPlaceholder}
                                className="h-8 text-xs"
                              />
                              <Input
                                type="date"
                                value={m.targetDate}
                                onChange={(e) =>
                                  handleUpdateMilestoneInput(idx, "targetDate", e.target.value)
                                }
                                className="h-8 text-xs"
                              />
                            </div>
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
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                {t.schedules.noSchedulesDesc}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground tracking-tight">
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
                        onClick={() => setScheduleToDelete(schedule.id)}
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
                    {schedule.milestones.map((m) => {
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
                                "flex size-6 shrink-0 items-center justify-center rounded-full border transition-all mt-0.5 cursor-pointer",
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

                              {m.targetDate && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="size-2.5" />
                                  <span>
                                    {new Date(m.targetDate).toLocaleDateString(undefined, {
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Campfire Discussion Button & Member check-in avatars / progress */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                setCampfireMilestone({
                                  milestone: m,
                                  scheduleName: schedule.name,
                                })
                              }
                              className={cn(
                                "h-7 px-2 gap-1.5 text-xs rounded-lg transition-colors font-medium",
                                m.hasCheckedIn
                                  ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                              )}
                              title={t.campfires.openCampfire}
                            >
                              <Flame
                                className={cn(
                                  "size-3.5",
                                  m.hasCheckedIn
                                    ? "text-amber-500 fill-amber-500/20"
                                    : "text-muted-foreground",
                                )}
                              />
                              <span>
                                {m.commentCount > 0 ? m.commentCount : t.campfires.openCampfire}
                              </span>
                            </Button>

                            <div className="flex -space-x-1.5 overflow-hidden">
                              {m.checkins.slice(0, 4).map((c) => (
                                <Avatar key={c.id} className="size-5 border border-background">
                                  <AvatarImage src={c.expand?.user?.avatarUrl} />
                                  <AvatarFallback className="text-[8px] font-mono">
                                    {getInitials(c.expand?.user?.name, c.expand?.user?.email)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {m.checkins.length > 4 && (
                                <div className="flex size-5 items-center justify-center rounded-full bg-muted border border-background text-[8px] font-medium text-muted-foreground">
                                  +{m.checkins.length - 4}
                                </div>
                              )}
                            </div>

                            <div className="text-right min-w-[45px]">
                              <span className="text-[10px] font-semibold text-foreground">
                                %{completionRate}
                              </span>
                              <p className="text-[9px] text-muted-foreground">
                                {checkinCount}/{memberCount}
                              </p>
                            </div>
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

      {/* Milestone Campfire Discussion Dialog */}
      <MilestoneCampfireDialog
        open={Boolean(campfireMilestone)}
        onOpenChange={(open) => !open && setCampfireMilestone(null)}
        milestone={campfireMilestone?.milestone ?? null}
        scheduleName={campfireMilestone?.scheduleName}
        groupId={groupId}
        isMember={isMember}
        onCheckinToggle={(milestoneId) => {
          if (campfireMilestone) {
            handleToggleCheckin(milestoneId, "");
            setCampfireMilestone((prev) =>
              prev
                ? {
                    ...prev,
                    milestone: {
                      ...prev.milestone,
                      hasCheckedIn: !prev.milestone.hasCheckedIn,
                    },
                  }
                : null,
            );
          }
        }}
      />

      {/* Accessible Base UI AlertDialog for Deletion Confirmation */}
      <AlertDialog open={!!scheduleToDelete} onOpenChange={(open) => !open && setScheduleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.confirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.schedules.deleteScheduleConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
