export const getPostsWithReactionsQuery = ({
	whereClause = '',
	orderByClause = '',
	limitClause = '',
	addressWhereClause = '',
}: {
	whereClause?: string;
	orderByClause?: string;
	limitClause?: string;
	addressWhereClause?: string;
}) => {
	return `
        SELECT
            p.id,
            p."createTimestamp",
            p."feedId",
            p.sender,
            p.meta,
            p.content,
            p.banned,
            p.blockchain,
            (
                SELECT COALESCE(jsonb_object_agg(r.reaction, r.count), '{}'::jsonb)
                FROM (
                    SELECT
                        "postId",
                        reaction,
                        COUNT(*) AS count
                    FROM
                        feed_post_reaction_entity
                    WHERE
                        "postId" = p.id
                    GROUP BY
                        "postId", reaction
                ) AS r
            ) AS "reactionsCounts",
            ${
				addressWhereClause
					? `(
                        SELECT COALESCE(jsonb_object_agg(ar.address, ar.reaction), '{}'::jsonb)
                        FROM (
                            SELECT
                                "postId",
                                address,
                                reaction
                            FROM
                                feed_post_reaction_entity
                            WHERE
                                "postId" = p.id
                                ${addressWhereClause}
                        ) AS ar
                    )`
					: `'{}'::jsonb`
			} AS "addressReactions"
        FROM
            venom_feed_post_entity p
        ${whereClause} ${orderByClause} ${limitClause};
    `;
};

export const getReactionsForPosts = (
	postIds: string[],
	addresses: string[],
): { query: string; parameters: (string | number)[] } => {
	const parameters: (string | number)[] = [];
	const postIdIn: string[] = [];
	const addressIn: string[] = [];
	postIds.forEach((p, i) => {
		parameters.push(p);
		postIdIn.push(`$${parameters.length}`);
	});
	const postIdInClause = postIdIn.join(', ');
	addresses.forEach((a, i) => {
		parameters.push(a);
		addressIn.push(`$${parameters.length}`);
	});
	const addressInClause = addressIn.join(', ');
	return {
		query: `
        SELECT
            "postId",
            jsonb_object_agg(address, reaction) as "addressReactions"
        FROM
            feed_post_reaction_entity
        WHERE
            "postId" in (${postIdInClause})
            ${addressInClause ? `and address in (${addressInClause})` : ''}
        GROUP BY "postId";`,
		parameters,
	};
};
