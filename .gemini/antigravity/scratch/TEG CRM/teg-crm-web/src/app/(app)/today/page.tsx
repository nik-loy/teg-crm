import { getTodayBuckets, type TodayBuckets } from "@/lib/notion/contacts";
import { env } from "@/lib/env";
import type { Contact } from "@/lib/types";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ owner?: string }>;
}

interface BucketConfig {
  key: keyof TodayBuckets;
  label: string;
  badgeClass: string;
  actionLabel: string;
}

const BUCKETS: BucketConfig[] = [
  {
    key: "replies",
    label: "Replies Needed",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    actionLabel: "Reply",
  },
  {
    key: "dueFollowups",
    label: "Follow-Ups Due",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    actionLabel: "Follow Up",
  },
  {
    key: "staleRequests",
    label: "Stale Requests",
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    actionLabel: "Check In",
  },
  {
    key: "noMessage",
    label: "Message Now",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    actionLabel: "Message",
  },
];

function ContactRow({ contact, actionLabel }: { contact: Contact; actionLabel: string }) {
  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(" · ") || "—";
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{contact.name || "Unnamed"}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <Link
        href={`/messages/${contact.id}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
      >
        {actionLabel}
      </Link>
    </div>
  );
}

function BucketSection({
  contacts,
  config,
}: {
  contacts: Contact[];
  config: BucketConfig;
}) {
  if (contacts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{config.label}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.badgeClass}`}
          >
            {contacts.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contacts.map((c) => (
          <ContactRow key={c.id} contact={c} actionLabel={config.actionLabel} />
        ))}
      </CardContent>
    </Card>
  );
}

export default async function TodayPage({ searchParams }: PageProps) {
  const { owner } = await searchParams;

  let buckets: TodayBuckets | null = null;
  let errorMsg: string | null = null;

  try {
    buckets = await getTodayBuckets(env.contactsDb(), owner);
  } catch (e) {
    console.error("[today page]", e);
    errorMsg =
      e instanceof Error ? e.message : "Could not reach Notion. Check your env vars.";
  }

  const totalItems = buckets
    ? BUCKETS.reduce((sum, b) => sum + buckets![b.key].length, 0)
    : 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Today</h1>
        {owner && (
          <span className="text-sm text-muted-foreground">
            Filtered: <strong>{owner}</strong>
          </span>
        )}
      </div>

      {errorMsg && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive font-medium">Failed to load</p>
            <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
          </CardContent>
        </Card>
      )}

      {buckets && totalItems === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-2xl mb-2">🎉</p>
            <p className="font-medium">You&apos;re all caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No actions pending for today.</p>
          </CardContent>
        </Card>
      )}

      {buckets &&
        BUCKETS.map((cfg) => (
          <BucketSection key={cfg.key} contacts={buckets![cfg.key]} config={cfg} />
        ))}
    </div>
  );
}
