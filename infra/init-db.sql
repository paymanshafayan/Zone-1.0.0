-- Zone Database Initialization
-- Enables PostGIS and pgvector extensions

-- PostGIS for geographic queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- pgvector for semantic similarity
CREATE EXTENSION IF NOT EXISTS vector;
