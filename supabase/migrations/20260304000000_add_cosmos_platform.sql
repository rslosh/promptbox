alter table collections
  drop constraint collections_platform_check,
  add constraint collections_platform_check
    check (platform in ('pinterest', 'are_na', 'tumblr', 'manual', 'cosmos'));
