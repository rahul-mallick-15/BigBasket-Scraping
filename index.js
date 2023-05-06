const puppeteer = require("puppeteer");
const bigbasket = require("./site.js");
const he = require("he");
const fs = require("fs");

//wait time to allow page load
const delayTime = 1500;

async function main() {
  console.time("Total Time");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--start-maximized"],
    defaultViewport: {
      width: 1536,
      height: 864,
    },
  });
  try {
    const page = (await browser.pages())[0];
    await page.goto(bigbasket.url);

    const completeList = new Array();

    const superCategories = (
      await page.$$eval(bigbasket.superCategories, (list) => {
        return list.map((a) => {
          return {
            name: a.innerHTML,
            href: a.href,
          };
        });
      })
    ).slice(8, 9);

    for (let sc of superCategories) {
      await page.goto(sc.href);
      await delay(delayTime);

      const categories = (
        await page.$$eval(`${bigbasket.categories} > a`, (list) => {
          return list.map((a) => {
            return {
              name: a.querySelector("span").innerHTML,
              href: a.href,
            };
          });
        })
      ).slice(0, 5);

      for (let c of categories) {
        await page.goto(c.href);
        await delay(delayTime);

        const subCategories = (
          await page.$$eval(`${bigbasket.subCategories} > a`, (list) => {
            return list.map((a) => {
              return {
                name: a.querySelector("span").innerHTML,
                href: a.href,
              };
            });
          })
        ).slice(0);

        for (let sub of subCategories) {
          await page.goto(sub.href);
          await delay(delayTime);
          const products = await page.$$eval(
            bigbasket.productDiv,
            (list, sc, c, sub) => {
              const getId = (href) => {
                const match = href.match(/\/pd\/(\d+)\//);
                if (match) {
                  return match[1];
                }
                return null;
              };
              const products = [];
              list = list.slice(list.length - 10);
              list.map((div) => {
                products.push({
                  City: document.querySelector(
                    "span[ng-bind='vm.user.currentAddress.city_name']"
                  ).innerHTML,
                  "Super Category": sc.name,
                  Category: c.name,
                  "Sub Category": sub.name,
                  "SKU ID": getId(div.querySelector("div.prod-view > a").href),
                  Image: div.querySelector("div.prod-view > a > img").src,
                  Brand: div.querySelector("div[qa='product_name'] > h6")
                    .innerHTML,
                  "SKU Name": div.querySelector("div[qa='product_name'] > a")
                    .innerHTML,
                  "SKU Size":
                    div.querySelector("span[ng-bind='vm.selectedProduct.w']")
                      .innerHTML +
                    " " +
                    div.querySelector(
                      "span[ng-bind='vm.selectedProduct.pack_desc']"
                    ).innerHTML,
                  MRP:
                    div.querySelector("span[ng-bind^='vm.selectedProduct.mrp']")
                      ?.innerHTML ||
                    div.querySelector("span[ng-bind^='vm.selectedProduct.sp']")
                      .innerHTML,
                  SP: div.querySelector(
                    "span[ng-bind^='vm.selectedProduct.sp']"
                  ).innerHTML,
                  Link: div.querySelector("div.prod-view > a").href,
                  Active: "Yes",
                  "Out of Stock":
                    div
                      .querySelector(
                        "span[ng-if='vm.selectedProduct.zero_results_listing!=true']"
                      )
                      .textContent.trim() === ""
                      ? "Yes"
                      : "No",
                });
              });
              return products;
            },
            sc,
            c,
            sub
          );

          products.map((product) => {
            for (let key of Object.keys(product)) {
              product[key] = he.decode(product[key]);
            }
          });
          completeList.push(...products);
          await page.goBack();
          await delay(delayTime);
        }
      }
    }
    // console.log(completeList);

    const stream = fs.createWriteStream("data.json");
    stream.write("[\n");
    completeList.forEach((obj, index) => {
      const comma = index === completeList.length - 1 ? "" : ",";
      stream.write(JSON.stringify(obj) + comma + "\n");
    });
    stream.write("]");

    stream.end();
  } catch (error) {
    console.log(error);
  } finally {
    await browser.close();
    console.timeEnd("Total Time");
  }
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
main();
