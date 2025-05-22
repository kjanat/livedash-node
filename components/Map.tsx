"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getLocalizedCountryName } from "../lib/localization";

interface CountryData {
  code: string;
  count: number;
  coordinates: [number, number];
}

interface MapProps {
  countryData: CountryData[];
  maxCount: number;
}

const Map = ({ countryData, maxCount }: MapProps) => {
  return (
    <MapContainer
      center={[30, 0]}
      zoom={2}
      zoomControl={true}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {countryData.map((country) => (
        <CircleMarker
          key={country.code}
          center={country.coordinates}
          radius={5 + (country.count / maxCount) * 20}
          pathOptions={{
            fillColor: "#3B82F6",
            color: "#1E40AF",
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6,
          }}
        >
          <Tooltip>
            <div className="p-1">
              <div className="font-medium">
                {getLocalizedCountryName(country.code)}
              </div>
              <div className="text-sm">Sessions: {country.count}</div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
};

export default Map;
