-- Migration 0014: Storage Objects RLS for Private Expense Receipts Bucket
-- Ensures owners and administrators can upload, view, and manage payment receipts.

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'expense_receipts_read'
  ) then
    create policy expense_receipts_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'expense-receipts' 
        and public.current_user_role() in ('owner', 'admin')
      );
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'expense_receipts_upload'
  ) then
    create policy expense_receipts_upload on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'expense-receipts' 
        and public.current_user_role() in ('owner', 'admin')
      );
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'expense_receipts_delete'
  ) then
    create policy expense_receipts_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'expense-receipts' 
        and public.current_user_role() in ('owner', 'admin')
      );
  end if;
end $$;
