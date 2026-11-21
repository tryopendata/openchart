---
title: "Table state"
description: "Controlled and uncontrolled tables: sort, search and page state, and the table state hooks."
section: api
order: 7
---
<!-- phase-4-stub -->

# Table state

## Table: controlled vs uncontrolled

### Uncontrolled (default)

The table manages its own sort, search, and pagination state internally. You get callbacks when state changes but don't need to manage state yourself.

**React:**

```tsx
import { DataTable } from "@opendata-ai/openchart-react";

<DataTable
  spec={tableSpec}
  onSortChange={(sort) => console.log("Sort changed:", sort)}
  onSearchChange={(query) => console.log("Search:", query)}
  onPageChange={(page) => console.log("Page:", page)}
/>;
```

**Vue:**

```vue
<template>
  <DataTable
    :spec="tableSpec"
    @sort-change="(sort) => console.log('Sort changed:', sort)"
    @search-change="(query) => console.log('Search:', query)"
    @page-change="(page) => console.log('Page:', page)"
  />
</template>
```

**Svelte:**

```svelte
<DataTable
  spec={tableSpec}
  onSortChange={(sort) => console.log("Sort changed:", sort)}
  onSearchChange={(query) => console.log("Search:", query)}
  onPageChange={(page) => console.log("Page:", page)}
/>
```

### Controlled

Pass `sort`, `search`, and/or `page` props to take over state management. When any of these are provided, the table reads state from props instead of managing it internally.

**React:**

```tsx
import { useState } from "react";
import { DataTable } from "@opendata-ai/openchart-react";
import type { SortState } from "@opendata-ai/openchart-core";

function ControlledTable({ spec }: { spec: TableSpec }) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  return (
    <div>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0); // Reset to first page on search
        }}
        placeholder="Search..."
      />
      <button onClick={() => setSort({ column: "name", direction: "asc" })}>
        Sort by name
      </button>
      <button onClick={() => setSort(null)}>Clear sort</button>

      <DataTable
        spec={spec}
        sort={sort}
        search={search}
        page={page}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
      />
    </div>
  );
}
```

**Vue:**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { DataTable } from "@opendata-ai/openchart-vue";
import type { SortState } from "@opendata-ai/openchart-core";

const sort = ref<SortState | null>(null);
const search = ref("");
const page = ref(0);

function onSearch(value: string) {
  search.value = value;
  page.value = 0; // Reset to first page on search
}
</script>

<template>
  <input :value="search" @input="onSearch($event.target.value)" placeholder="Search..." />
  <button @click="sort = { column: 'name', direction: 'asc' }">Sort by name</button>
  <button @click="sort = null">Clear sort</button>

  <DataTable
    :spec="spec"
    :sort="sort"
    :search="search"
    :page="page"
    @sort-change="(s) => sort = s"
    @search-change="(q) => search = q"
    @page-change="(p) => page = p"
  />
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { DataTable } from "@opendata-ai/openchart-svelte";
import type { SortState } from "@opendata-ai/openchart-core";

let sort: SortState | null = $state(null);
let search = $state("");
let page = $state(0);

function onSearch(value: string) {
  search = value;
  page = 0; // Reset to first page on search
}
</script>

<input value={search} oninput={(e) => onSearch(e.target.value)} placeholder="Search..." />
<button onclick={() => sort = { column: "name", direction: "asc" }}>Sort by name</button>
<button onclick={() => sort = null}>Clear sort</button>

<DataTable
  {spec}
  {sort}
  {search}
  {page}
  onSortChange={(s) => sort = s}
  onSearchChange={(q) => search = q}
  onPageChange={(p) => page = p}
/>
```

### useTableState hook/composable

For a quick way to get controlled state without wiring it all manually. Available in all three frameworks:

**React:**

```tsx
import { DataTable, useTableState } from "@opendata-ai/openchart-react";

function TableWithManagedState({ spec }: { spec: TableSpec }) {
  const { sort, search, page, setSort, setSearch, setPage, resetState } =
    useTableState();

  return (
    <div>
      <button onClick={resetState}>Reset</button>
      <DataTable
        spec={spec}
        sort={sort}
        search={search}
        page={page}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
      />
    </div>
  );
}
```

**Vue:**

```vue
<script setup lang="ts">
import { DataTable, useTableState } from "@opendata-ai/openchart-vue";

const { sort, search, page, setSort, setSearch, setPage, resetState } =
  useTableState();
</script>

<template>
  <button @click="resetState">Reset</button>
  <DataTable
    :spec="spec"
    :sort="sort"
    :search="search"
    :page="page"
    @sort-change="setSort"
    @search-change="setSearch"
    @page-change="setPage"
  />
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { DataTable, useTableState } from "@opendata-ai/openchart-svelte";

const { sort, search, page, setSort, setSearch, setPage, resetState } =
  useTableState();
</script>

<button onclick={resetState}>Reset</button>
<DataTable
  {spec}
  sort={sort}
  search={search}
  page={page}
  onSortChange={setSort}
  onSearchChange={setSearch}
  onPageChange={setPage}
/>
```

All versions accept optional initial values:

```ts
const state = useTableState({
  sort: { column: "name", direction: "asc" },
  search: "",
  page: 0,
});
```

### useTable hook/composable (advanced)

For cases where you need direct access to the vanilla `TableInstance`:

**React:**

```tsx
import { useTable } from "@opendata-ai/openchart-react";

function AdvancedTable({ spec }: { spec: TableSpec }) {
  const { ref, table, state } = useTable(spec, {
    onRowClick: (row) => console.log("Clicked:", row),
    autoResize: true,
  });

  return (
    <div>
      <p>Current page: {state.page}</p>
      <p>Sort: {state.sort?.column ?? "none"}</p>
      <button onClick={() => table?.export("csv")}>Export CSV</button>
      <div ref={ref} style={{ width: "100%", height: 500 }} />
    </div>
  );
}
```

**Vue:**

```vue
<script setup lang="ts">
import { useTable } from "@opendata-ai/openchart-vue";

const { containerRef, table, layout } = useTable(spec, {
  onRowClick: (row) => console.log("Clicked:", row),
  autoResize: true,
});
</script>

<template>
  <button @click="table?.export('csv')">Export CSV</button>
  <div ref="containerRef" style="width: 100%; height: 500px" />
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { useTable } from "@opendata-ai/openchart-svelte";

const { action, table, layout } = useTable(spec, {
  onRowClick: (row) => console.log("Clicked:", row),
  autoResize: true,
});
</script>

<button onclick={() => table?.export("csv")}>Export CSV</button>
<div use:action style="width: 100%; height: 500px"></div>
```

### Table sort cycling

Sort behavior follows a three-state cycle:

- Click column: sort ascending
- Click same column again: sort descending
- Click same column again: clear sort

Clicking a different column resets to ascending for that column.
