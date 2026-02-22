-- ============================================================
-- AI Learning Assistant – Supabase Database Setup
-- Run this once in the Supabase SQL Editor
-- ============================================================

-- 1. Enable the pgvector extension
create extension if not exists vector;

-- 2. Documents table (one record per YouTube video or PDF)
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  source_type  text not null check (source_type in ('youtube', 'pdf')),
  source_url   text,
  created_at   timestamptz default now()
);

-- 3. Chunks table with 768-dimensional embedding (Gemini gemini-embedding-001, output_dimensionality=768)
create table if not exists chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid references documents(id) on delete cascade not null,
  content      text not null,
  embedding    vector(768),
  chunk_index  int not null,
  created_at   timestamptz default now()
);

-- 4. Index for fast vector search
create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 5. Similarity search function (called via Supabase RPC)
create or replace function match_chunks(
  query_embedding vector(768),
  doc_id          uuid,
  match_count     int default 5
)
returns table (
  id         uuid,
  content    text,
  similarity float
)
language sql
stable
as $$
  select
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from chunks
  where document_id = doc_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
