import { RESOURCE_KINDS } from "@repo/shared";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import type { ExpertiseArea } from "@/lib/content";
import type { ResourceListItem } from "@/lib/content/resources";
import { FilterChips, ResourceCard } from "../listing";
import { ResourceList } from "../listing/resource-card";
import { MoreLink } from "../parts";
import { AREA_PARAM, KIND_PARAM, listingQuery, RESOURCES_PATH, type ResourcesQuery } from "./query";
import { ResourceDownload } from "./resource-download";

/**
 * `/resources` under its header: the expertise and type chips, then the
 * resources as rows (ResourceItem, §6.9), or an empty state in his voice. `resources` holds only what's public in this
 * language. The file itself is reached only through the download route.
 */
export function ResourcesList({
  resources,
  areas,
  query,
}: {
  resources: ResourceListItem[];
  /** Expertise areas published in this language. */
  areas: ExpertiseArea[];
  query: ResourcesQuery;
}) {
  const t = useTranslations("Resources");
  const listing = useTranslations("PublicListing");
  const kept = listingQuery(query);
  const filtered = query.area !== null || query.kind !== null;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3.5">
        {areas.length > 0 && (
          <FilterChips
            label={t("areaLabel")}
            pathname={RESOURCES_PATH}
            param={AREA_PARAM}
            options={areas.map((area) => ({ value: area.slug, label: area.title }))}
            query={kept}
          />
        )}
        <FilterChips
          label={t("kindLabel")}
          pathname={RESOURCES_PATH}
          param={KIND_PARAM}
          options={RESOURCE_KINDS.map((kind) => ({ value: kind, label: listing(`resourceKind.${kind}`) }))}
          query={kept}
        />
        {/* Announces the new count after a filter, zero included. */}
        <p role="status" className="text-ink-2 type-small empty:hidden">
          {(resources.length > 0 || filtered) && t("resultsCount", { count: resources.length })}
        </p>
      </div>

      <div className="mt-7">
        {resources.length === 0 ? (
          filtered ? (
            <EmptyState
              level={2}
              outline={false}
              title={t("noResultsState.title")}
              text={t("noResultsState.text")}
              action={<MoreLink href={RESOURCES_PATH} label={t("noResultsState.action")} />}
            />
          ) : (
            <EmptyState level={2} title={t("emptyState.title")} text={t("emptyState.text")} />
          )
        ) : (
          <ResourceList>
            {resources.map((resource) => (
              <ResourceCard
                key={resource.id}
                kind={resource.kind}
                // The public read doesn't carry the file's format.
                fileType={null}
                title={resource.title}
                description={resource.description}
                tags={resource.expertise ? [resource.expertise.title] : []}
                action={<ResourceDownload id={resource.id} title={resource.title} access={resource.access} />}
              />
            ))}
          </ResourceList>
        )}
      </div>
    </div>
  );
}
