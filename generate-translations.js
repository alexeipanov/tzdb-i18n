import fs from "fs";
import got from "got";
import path from "path";
import readline from "readline";
import unzipper from "unzipper";
import timezones from "./raw-time-zones.json";
import { parse as csvParse } from "csv-parse";
import collations from "./city-collation.json";

const lang = process.env.npm_config_language || 'en';

const filteredCities = [];

async function run() {
  const alternatesCsv = got
    .stream("https://download.geonames.org/export/dump/alternateNames.zip")
    .pipe(unzipper.ParseOne("alternateNames.txt"));

  const alternatesParser = alternatesCsv.pipe(
    csvParse({
      delimiter: "\t",
      skipRecordsWithError: true,
    }),
  );

  for await (const cityFields of alternatesParser) {
    if (cityFields[2] === lang) {
      filteredCities.push({ id: Number(cityFields[1]), name: cityFields[3] });
    }
  }

  const translations = {};
  const cityTranslations = fs.createWriteStream(`./locale/${lang}.json`);

  for (const timezone of timezones) {
    for (const city of timezone.mainCities) {
      const collation = collations.find((c) => { return c.country === timezone.countryCode && c.city === city; });
      const translation = filteredCities.find((fc) => { return fc.id === collation?.geonameid; }) || city;
      translations[timezone.countryCode] = { ...translations[timezone.countryCode], ...Object.fromEntries([[city, translation.name]]) };
      // translations[countryCode] = { ...translations[countryCode], ...Object.fromEntries([[snakeCase(city), city]])};
    }
  }

  cityTranslations.write(JSON.stringify(translations, null, " "));
  cityTranslations.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
