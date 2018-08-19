import { Serializer } from 'ember-cli-mirage';

export default Serializer.extend({
  serialize({ models }, request) {
    let limit = parseInt(request.queryParams.limit, 10);
    let perPage = parseInt(request.queryParams.per_page, 10);
    let startPage = parseInt(request.queryParams.page, 10);

    let pageCount = Math.ceil(limit || models.length / perPage);
    let offset = perPage * (startPage - 1);
    let subset;

    if (limit) {
      subset = models.slice(offset, limit);
    } else {
      subset = models.slice(offset, offset + perPage);
    }

    return { posts: subset, meta: { total_pages: pageCount } };
  }
});
