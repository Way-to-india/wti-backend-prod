-- Phase B — curated multimodal transport pool (rail + air).
-- Seeded from the Indian Railways timetable JSONs and the DGCA domestic flight
-- schedule CSV by scripts/seed-transport.ts. Additive, idempotent.

-- ---- RAIL ----
CREATE TABLE IF NOT EXISTS train_schedules (
  train_no      text PRIMARY KEY,
  train_name    text,
  running_days  smallint NOT NULL DEFAULT 127  -- Mon=bit0 .. Sun=bit6
);

CREATE TABLE IF NOT EXISTS train_stops (
  train_no      text NOT NULL,
  seq           int  NOT NULL,
  station_code  text NOT NULL,
  station_name  text,
  arr_min       int,     -- minutes from midnight (null at source)
  dep_min       int,
  day_offset    int NOT NULL DEFAULT 0, -- days after train's day-1
  cum_km        int,
  PRIMARY KEY (train_no, seq)
);
CREATE INDEX IF NOT EXISTS train_stops_station_idx ON train_stops (station_code);

CREATE TABLE IF NOT EXISTS train_stations (
  code   text PRIMARY KEY,
  name   text,
  city   text,
  lat    double precision,
  lng    double precision
);
CREATE INDEX IF NOT EXISTS train_stations_geo_idx ON train_stations (lat, lng);

-- ---- AIR ----
CREATE TABLE IF NOT EXISTS airport_cities (
  city  text PRIMARY KEY,
  lat   double precision,
  lng   double precision
);

CREATE TABLE IF NOT EXISTS flight_sectors (
  id             bigserial PRIMARY KEY,
  origin_city    text NOT NULL,
  dest_city      text NOT NULL,
  flight_no      text,
  airline        text,
  dep_min        int,
  arr_min        int,
  dur_min        int,
  day_offset     int NOT NULL DEFAULT 0,
  operating_days smallint NOT NULL DEFAULT 127,
  aircraft       text,
  eff_from       date,
  eff_to         date
);
CREATE INDEX IF NOT EXISTS flight_sectors_od_idx ON flight_sectors (lower(origin_city), lower(dest_city));
