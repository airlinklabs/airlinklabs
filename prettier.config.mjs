export default {
  plugins: ["prettier-plugin-ejs"],

  overrides: [
    {
      files: ["**/*.ejs"],
      options: {
        parser: "html",
      },
    },
  ],
};