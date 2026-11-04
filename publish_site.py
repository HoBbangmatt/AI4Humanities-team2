"""Copy the current calendar and generated CSVs into the GitHub Pages folder."""
from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parent
FILES = ["index.html", "bootstrap.css", "bootstrap.min.js", "calendermap.js",
         "citation-config.js", "citation-links.js", "citation-demo.html",
         "data.csv", "Events_date_weekday.csv", "LICENSE.txt"]
def main():
    target = ROOT / "docs" / "calendar"
    missing = [name for name in FILES if not (ROOT / name).is_file()]
    if missing:
        raise SystemExit("Missing files: " + ", ".join(missing))
    target.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        shutil.copyfile(ROOT / name, target / name)
    (ROOT / "docs" / ".nojekyll").touch()
    print("Ready: publish docs from GitHub Pages. Preview at /docs/.")
if __name__ == "__main__":
    main()
